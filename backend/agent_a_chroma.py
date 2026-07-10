"""
A2Z Agentz - Agent A (The Scout): ChromaDB Semantic Dedup Stage
===============================================================

Pipeline position:
 [current source data] -> JSON Lines -> [agent_a_chroma (THIS)] -> JSON Lines
 -> [downstream vLLM inference] -> publication to DB

Responsibilities:
 1. Lazy-init a PersistentClient rooted at `CHROMA_PATH` so embeddings
    survive service restarts.
 2. Expose `check_semantic_similarity(description, threshold)` - the
    module that stops the same kind of opportunity from being processed twice.
 3. Expose `insert_project_embedding(project_id, description, metadata)` -
    used for records that clear the pipeline.
 4. CLI reads JSON Lines from stdin (or `--file`) and emits one
    decision JSON per record on stdout, log lines on stderr.

Distance semantics:
 The collection is created with `hnsw:space=cosine`. With cosine
 distance, two normalized vectors produce:
 distance = 1 - cosine_similarity
 similarity = 1 - distance (range: [-1, 1])
 So `threshold=0.85` blocks records whose similarity EXCEEDS 0.85,
 i.e. cosine_distance < 0.15 - the natural reading of the spec.

Error policy:
 ChromaDB / I/O failures during lookup are treated as FAIL-OPEN (the
 record is allowed through) because semantic dedup is opportunistic:
 it guards against accidental re-processing, not against loss of funds.
 Compare with `database.is_blacklisted` which fail-CLOSES - blacklist
 is safety-critical, dedup is not. Errors are still logged at ERROR.

Dependencies (added to requirements.txt):
 chromadb - PersistentClient + collection API
 onnxruntime - required by ChromaDB's default embedding function
 tokenizers - required by ChromaDB's default embedding function
 (huggingface-hub, numpy, etc. come in transitively)
"""

from __future__ import annotations

import argparse
import hashlib
import json
import logging
import sys
import os
import threading
from pathlib import Path
from typing import Optional, Tuple

try:
    import chromadb
    from chromadb.api.models.Collection import Collection
    from chromadb.config import Settings
    from chromadb.utils import embedding_functions
    HAS_CHROMA = True
except ImportError:
    HAS_CHROMA = False
    class Collection: pass
    class Settings: pass
    class embedding_functions:
        DefaultEmbeddingFunction = lambda: None


# ----------------------------------------------------------------------------
# Constants
# ----------------------------------------------------------------------------
CHROMA_PATH: str = os.getenv("CHROMA_PATH", ".chroma_db") or ".chroma_db"
if os.path.isabs(CHROMA_PATH):
    CHROMA_DIR = CHROMA_PATH
else:
    CHROMA_DIR = os.path.join(os.getcwd(), CHROMA_PATH)
COLLECTION_NAME: str = "project_embeddings"
DEFAULT_THRESHOLD: float = 0.85 # similarity threshold (1 - cosine_distance)


# ----------------------------------------------------------------------------
# Logger (same `a2z.*` namespace family as database.py / web3_async.py /
# agent_a_producer.py - stderr only, so stdout stays pipe-clean)
# ----------------------------------------------------------------------------
logger = logging.getLogger("a2z.agent_a.chroma")
if not logger.handlers:
    _h = logging.StreamHandler()
    _h.setFormatter(logging.Formatter("[%(asctime)s] %(levelname)s a2z.agent_a.chroma: %(message)s"))
    logger.addHandler(_h)
logger.setLevel(logging.INFO)


# ----------------------------------------------------------------------------
# Lazy singletons - ChromaDB init + model download is expensive (~80 MB
# on first run for the default MiniLM model), so we only do it when the
# first semantic lookup actually happens.
# ----------------------------------------------------------------------------
_client: Optional[chromadb.PersistentClient] = None
_collection: Optional[Collection] = None


def _ensure_storage_dir() -> None:
    """Create a writable ChromaDB storage dir, or raise a clear OSError."""
    try:
        Path(CHROMA_PATH).mkdir(parents=True, exist_ok=True)
    except OSError as exc:
        logger.error("Cannot create ChromaDB directory %s: %s", CHROMA_PATH, exc)

_client_singleton = None
_client_lock = threading.Lock()


def get_chroma_client():
    global _client_singleton
    if _client_singleton is None:
        with _client_lock:
            if _client_singleton is None:
                os.makedirs(CHROMA_PATH, exist_ok=True)
                _client_singleton = chromadb.PersistentClient(
                    path=CHROMA_PATH,
                    settings=Settings(anonymized_telemetry=False)
                )
    return _client_singleton


def get_collection() -> Optional[Collection]:
    """Return the singleton `project_embeddings` collection (cosine space)."""
    if not HAS_CHROMA:
        logger.warning("chromadb not installed, returning mock persistent client")
        return None

    client = get_chroma_client()
    ef = embedding_functions.DefaultEmbeddingFunction()
    return client.get_or_create_collection(
        name=COLLECTION_NAME,
        embedding_function=ef,
        metadata={"hnsw:space": "cosine", "description": "A2Z Agentz - Base project embeddings"},
    )


# ----------------------------------------------------------------------------
# Public API (importable)
# ----------------------------------------------------------------------------
def check_semantic_similarity(
    description: str,
    threshold: float = DEFAULT_THRESHOLD,
) -> Tuple[bool, float, Optional[dict]]:
    """
    Look up the closest existing embedding to `description`.

    Returns:
        (is_too_similar, similarity_score, matched_metadata_or_none)
        - is_too_similar : True iff similarity_score > threshold
        - similarity_score: float in [-1, 1] (1 - cosine_distance)
        - matched_metadata: dict from the closest row, or None if the
                            collection is empty / query failed / match
                            not returned metadata.

    Fail-OPEN on ChromaDB errors: returns (False, 0.0, None) so a transient
    vector-DB outage does not block ingestion of new opportunities.
    """
    if not HAS_CHROMA:
        return False, 0.0, None

    if not description or not description.strip():
        return False, 0.0, None

    try:
        col = get_collection()
        if col.count() == 0:
            return False, 0.0, None

        results = col.query(
            query_texts=[description.strip()],
            n_results=1,
            include=["distances", "metadatas"],
        )
    except Exception as exc:
        logger.error("ChromaDB query failed - fail-OPEN: %s", exc)
        return False, 0.0, None

    distances = (results.get("distances") or [[]])[0]
    metadatas = (results.get("metadatas") or [[]])[0]

    if not distances:
        return False, 0.0, None

    distance = float(distances[0])
    similarity = 1.0 - distance # cosine distance -> similarity in [-1, 1]
    matched_metadata = metadatas[0] if metadatas else None

    return similarity > threshold, similarity, matched_metadata


def insert_project_embedding(
    project_id: str,
    description: str,
    metadata: Optional[dict] = None,
) -> str:
    """Persist a project embedding so future runs can dedup against it."""
    if not HAS_CHROMA:
        return project_id

    if not project_id or not str(project_id).strip():
        raise ValueError("project_id must be a non-empty string")
    if not description or not description.strip():
        logger.warning("Empty description for project %s; skipping vector insert.", project_id)
        return project_id

    payload_meta: dict = {}
    for k, v in (metadata or {}).items():
        if isinstance(v, (str, int, float, bool)) or v is None:
            payload_meta[str(k)] = v
        else:
            payload_meta[str(k)] = str(v)
    payload_meta.setdefault("description_preview", description.strip()[:200])
    payload_meta.setdefault("inserted_at", _now_iso())

    try:
        col = get_collection()
        col.add(
            ids=[str(project_id)],
            documents=[description.strip()],
            metadatas=[payload_meta],
        )
    except Exception as exc:
        logger.error("ChromaDB insert failed for %s: %s", project_id, exc)
        raise

    logger.info("Inserted embedding project_id=%s (collection size now=%d)",
                project_id, col.count())
    return str(project_id)


def derive_project_id(record: dict) -> str:
    """
    Pick a stable, canonical project_id from a scraper record.
    Preference: target_address (unique on-chain) -> sha256(description) fallback.
    """
    addr = (record.get("target_address") or "").strip()
    if addr:
        return addr
    desc = (record.get("description") or "").strip()
    if desc:
        return "sha256:" + hashlib.sha256(desc.encode("utf-8")).hexdigest()[:32]
    return "anon:" + hashlib.sha256(json.dumps(record, sort_keys=True).encode()).hexdigest()[:32]


def _now_iso() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()


# ----------------------------------------------------------------------------
# Pipeline glue (CLI: stdin JSON Lines -> decision JSON Lines)
# ----------------------------------------------------------------------------
def _process_record(record: dict, threshold: float) -> dict:
    """Apply semantic dedup to one scraper-emitted record."""
    description = (record.get("description") or "").strip()
    project_name = record.get("project_name") or "unknown"
    project_id = derive_project_id(record)

    is_too_similar, score, matched_meta = check_semantic_similarity(description, threshold)

    return {
        "project_id": project_id,
        "project_name": project_name,
        "target_address": record.get("target_address"),
        "description": description,
        "source": record.get("source"),
        "scraped_at": record.get("scraped_at"),
        "similarity_score": round(score, 4),
        "is_too_similar": is_too_similar,
        "matched_metadata": matched_meta,
    }


def _parse_args(argv: Optional[list[str]] = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Agent A - ChromaDB semantic-dedup stage.",
    )
    p.add_argument("--threshold", type=float, default=DEFAULT_THRESHOLD,
                   help=f"Similarity threshold in [0, 1]. Default: {DEFAULT_THRESHOLD}")
    p.add_argument("--file", default="-",
                   help="Read JSONL from path (default: stdin, '-' = stdin)")
    p.add_argument("--insert-passed", action="store_true",
                   help="Also call insert_project_embedding() for records that pass dedup. "
                        "Off by default - production should let the downstream vLLM stage "
                        "decide which survivors are 'approved' and worth remembering.")
    return p.parse_args(argv)


def main(argv: Optional[list[str]] = None) -> int:
    args = _parse_args(argv)

    in_stream = sys.stdin if args.file == "-" else open(args.file, "r", encoding="utf-8")
    passed = 0
    blocked = 0
    errors = 0

    try:
        for line_no, raw in enumerate(in_stream, 1):
            line = raw.strip()
            if not line:
                continue
            try:
                record = json.loads(line)
            except json.JSONDecodeError as exc:
                logger.error("Line %d: invalid JSON (%s) - skipping", line_no, exc)
                errors += 1
                continue

            try:
                decision = _process_record(record, args.threshold)
            except Exception as exc:
                logger.exception("Line %d: processing crashed - skipping", line_no)
                errors += 1
                continue

            if decision["is_too_similar"]:
                blocked += 1
                matched_preview = ((decision["matched_metadata"] or {}).get("description_preview") or "")
                logger.info(
                    "Semantic duplicate | project=%s score=%.4f > %.2f | matched_preview=%r",
                    decision["project_name"], decision["similarity_score"],
                    args.threshold, matched_preview,
                )
            else:
                passed += 1
                logger.info(
                    "Semantic OK | project=%s score=%.4f <= %.2f",
                    decision["project_name"], decision["similarity_score"], args.threshold,
                )

            if args.insert_passed:
                try:
                    insert_project_embedding(
                        project_id=decision["project_id"],
                        description=decision["description"],
                        metadata={
                            "project_name": decision["project_name"],
                            "target_address": decision["target_address"],
                            "source": decision["source"],
                            "similarity_score": decision["similarity_score"],
                        },
                    )
                except Exception as exc:
                    logger.error("Insert failed for %s: %s", decision["project_id"], exc)
                    errors += 1
                    continue

            # Emit one decision JSON per line -> pipe-clean stdout.
            print(json.dumps(decision, ensure_ascii=False, separators=(",", ":")), flush=True)
    finally:
        if in_stream is not sys.stdin:
            in_stream.close()

    logger.info(
        "Chroma pipeline done | passed=%d blocked=%d errors=%d threshold=%.2f",
        passed, blocked, errors, args.threshold,
    )
    # 0 = clean run; 1 = any per-record error or zero-emission (cron alert).
    return 0 if (errors == 0 and passed > 0) else 1


if __name__ == "__main__":
    sys.exit(main())
