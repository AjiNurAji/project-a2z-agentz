import requests
import time
import json
import uuid

API_URL = "http://localhost:8000/analyze"

def run_test(name, target_address, description):
    print(f"\n--- {name} ---")
    payload = {
        "target_address": target_address,
        "description": description
    }
    try:
        start_time = time.time()
        response = requests.post(API_URL, json=payload)
        elapsed = time.time() - start_time
        print(f"Status Code: {response.status_code}")
        print(f"Response ({elapsed:.2f}s): {json.dumps(response.json(), indent=2)}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    print("Starting end-to-end testing (Flowchart Test)...")
    
    # Generate unique addresses so we don't hit old blacklists across runs
    good_address = "0x" + (uuid.uuid4().hex + uuid.uuid4().hex)[:40]
    bad_address = "0x" + (uuid.uuid4().hex + uuid.uuid4().hex)[:40]

    # Test A: Golden Path (Good Project)
    # The AI should score this > 85, so it should be executed.
    good_desc = f"Super fast and secure L2 rollup on Base with audited contracts. Revolutionizing agent-to-agent payments. {uuid.uuid4()}"
    run_test("Test A: Valid Project (Golden Path)", good_address, good_desc)

    # Test B: Semantic Deduplication (ChromaDB)
    # Exact same description, should be bypassed by ChromaDB
    run_test("Test B: Semantic Deduplication (ChromaDB)", good_address, good_desc)

    # Test C: Blacklist (Low Score)
    # The AI should score this low (<= 85) due to "rugpull" language, and insert to Blacklist
    bad_desc = f"1000x guaranteed return anon, send funds directly to contract no audit needed trust this degen {uuid.uuid4()}"
    run_test("Test C: Blacklist Insertion (Low Score)", bad_address, bad_desc)

    # Test D: Database Blacklist Check
    # Same address, should be rejected by PostgreSQL before reaching AI or Chroma
    run_test("Test D: DB Blacklist Early Rejection", bad_address, bad_desc)
