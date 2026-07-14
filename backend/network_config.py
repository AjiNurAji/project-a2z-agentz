"""
A2Z Agentz — Dual-Home Network Architecture
============================================

Single Source of Truth (SSOT) for network configuration. Every module
(Agent B, Factory, API, web3_async) MUST resolve RPC / chain_id / router /
explorer / vault from this module instead of hardcoding addresses or reading
raw env vars scattered across files.

Usage
-----
    from network_config import get_config, ACTIVE_NETWORK, log_network_mode

    cfg = get_config()                       # uses ACTIVE_NETWORK from env
    cfg = get_config("base_sepolia")         # explicit override
    rpc = cfg.rpc_urls[0]
    router = cfg.router_address
    cid = cfg.chain_id

Design
------
* Two homes: ``base`` (mainnet, chain 8453) and ``base_sepolia`` (testnet,
  chain 84532). Switching is driven solely by ``ACTIVE_NETWORK`` in .env.
* Vault segregation: mainnet and testnet resolve DIFFERENT vault addresses
  and (where configured) different vault private keys, so execution data
  never cross-contaminates.
* The very first log line of any process that imports this module prints the
  active network + selected RPC, so we never aim at the wrong chain.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from typing import List, Optional

logger = logging.getLogger("a2z.network")

# ---------------------------------------------------------------------------
# Network identifiers
# ---------------------------------------------------------------------------
NETWORK_MAINNET = "base"
NETWORK_TESTNET = "base_sepolia"

ACTIVE_NETWORK: str = os.getenv("ACTIVE_NETWORK", NETWORK_MAINNET).strip().lower()

# Known Base chain ids
CHAIN_ID_MAINNET = 8453
CHAIN_ID_TESTNET = 84532

# Canonical Base Uniswap V2 Router02 (mainnet)
UNISWAP_V2_ROUTER_MAINNET = "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24"
# Self-deployed Uniswap V2 Router02 on Base Sepolia (testnet sandbox)
UNISWAP_V2_ROUTER_TESTNET = "0x47f5a990169Ec59e2013875478B52fe42146bA9b"

WETH_BASE = "0x4200000000000000000000000000000000000006"

EXPLORER_MAINNET = "https://basescan.org"
EXPLORER_TESTNET = "https://sepolia.basescan.org"


@dataclass(frozen=True)
class NetworkConfig:
    """Immutable network descriptor — the Single Source of Truth."""

    name: str
    is_mainnet: bool
    chain_id: int
    rpc_urls: List[str]
    router_address: str
    explorer_url: str
    vault_address: str
    vault_private_key: Optional[str] = None
    weth_address: str = WETH_BASE

    @property
    def network_flag(self) -> str:
        """Short flag stored in DB columns to segregate execution data."""
        return "mainnet" if self.is_mainnet else "testnet"

    def describe(self) -> str:
        return (
            f"[{self.name} | chain={self.chain_id} | "
            f"router={self.router_address} | explorer={self.explorer_url} | "
            f"vault={self.vault_address}]"
        )


# ---------------------------------------------------------------------------
# 30-minute deterministic RPC rotation (spreads Alchemy quota across keys)
# ---------------------------------------------------------------------------
_ROTATE_BUCKET_S = 30 * 60


def _rotated_order(urls: List[str], bucket: Optional[int] = None) -> List[str]:
    """Rotate a list of URLs by the current 30-min wall-clock bucket.

    Deterministic: every new caller in the same 30-min window gets the same
    rotated order, and the order shifts exactly once every 30 minutes. No
    background scheduler required.
    """
    import time

    if bucket is None:
        bucket = int(time.time()) // _ROTATE_BUCKET_S
    cleaned = [u for u in urls if u]
    if not cleaned:
        return []
    shift = bucket % len(cleaned)
    return cleaned[shift:] + cleaned[:shift]


def _resolve_rpc_urls(network: str) -> List[str]:
    """Build the rotated RPC list for a network from env vars."""
    if network == NETWORK_TESTNET:
        return _rotated_order([
            os.environ.get("BASE_SEPOLIA_RPC", ""),
            os.environ.get("BASE_SEPOLIA_RPC_1", ""),
            os.environ.get("BASE_SEPOLIA_RPC_2", ""),
        ])
    # mainnet
    return _rotated_order([
        os.environ.get("BASE_RPC_1", ""),
        os.environ.get("BASE_RPC_2", ""),
        os.environ.get("BASE_RPC_3", ""),
        os.environ.get("BASE_RPC_4", ""),
    ])


def _resolve_vault(network: str):
    """Resolve (address, private_key) for the active network.

    Vault segregation rule:
      * testnet  -> VAULT_ADDRESS / VAULT_PRIVATE_KEY (testnet-specific)
      * mainnet  -> VAULT_ADDRESS (reuse) but a dedicated MAINNET_VAULT_*
                    if present, else fall back to VAULT_ADDRESS.

    This keeps testnet and mainnet execution wallets/addresses separable.
    """
    addr = (os.environ.get("VAULT_ADDRESS") or "").strip()
    key = (os.environ.get("VAULT_PRIVATE_KEY") or "").strip()
    if network == NETWORK_TESTNET:
        # Prefer explicit testnet vault if provided, else shared VAULT_ADDRESS
        test_addr = (os.environ.get("TESTNET_VAULT_ADDRESS") or addr).strip()
        test_key = (os.environ.get("TESTNET_VAULT_PRIVATE_KEY") or key).strip()
        return test_addr, (test_key or None)
    # mainnet: allow a dedicated mainnet vault override
    main_addr = (os.environ.get("MAINNET_VAULT_ADDRESS") or addr).strip()
    main_key = (os.environ.get("MAINNET_VAULT_PRIVATE_KEY") or key).strip()
    return main_addr, (main_key or None)


# ---------------------------------------------------------------------------
# Config registry
# ---------------------------------------------------------------------------
def _build_config(network: str) -> NetworkConfig:
    is_mainnet = network == NETWORK_MAINNET
    if is_mainnet:
        cid = CHAIN_ID_MAINNET
        router = UNISWAP_V2_ROUTER_MAINNET
        explorer = EXPLORER_MAINNET
    else:
        cid = CHAIN_ID_TESTNET
        router = UNISWAP_V2_ROUTER_TESTNET
        explorer = EXPLORER_TESTNET

    rpc_urls = _resolve_rpc_urls(network)
    vault_addr, vault_key = _resolve_vault(network)
    return NetworkConfig(
        name=network,
        is_mainnet=is_mainnet,
        chain_id=cid,
        rpc_urls=rpc_urls,
        router_address=router,
        explorer_url=explorer,
        vault_address=vault_addr,
        vault_private_key=vault_key,
    )


# Cache (env is read once at import; restart to pick up .env changes)
_CONFIG_CACHE: dict = {}


def get_config(network: Optional[str] = None) -> NetworkConfig:
    """Return the NetworkConfig for ``network`` (defaults to ACTIVE_NETWORK).

    Raises RuntimeError if the network is unknown or has no RPC configured,
    so misconfiguration fails loud instead of silently hitting mainnet.
    """
    net = (network or ACTIVE_NETWORK).strip().lower()
    if net not in (NETWORK_MAINNET, NETWORK_TESTNET):
        raise RuntimeError(
            f"Unknown ACTIVE_NETWORK={net!r}. Expected "
            f"'{NETWORK_MAINNET}' or '{NETWORK_TESTNET}'."
        )
    if net not in _CONFIG_CACHE:
        _CONFIG_CACHE[net] = _build_config(net)
    return _CONFIG_CACHE[net]


def is_mainnet(network: Optional[str] = None) -> bool:
    return get_config(network).is_mainnet


def is_testnet(network: Optional[str] = None) -> bool:
    return not get_config(network).is_mainnet


def chain_id_for(network: Optional[str] = None) -> int:
    return get_config(network).chain_id


def router_for(network: Optional[str] = None) -> str:
    return get_config(network).router_address


def rpc_for(network: Optional[str] = None) -> str:
    urls = get_config(network).rpc_urls
    if not urls:
        raise RuntimeError(f"No RPC configured for network={network or ACTIVE_NETWORK}")
    return urls[0]


def vault_for(network: Optional[str] = None):
    cfg = get_config(network)
    return cfg.vault_address, cfg.vault_private_key


# ---------------------------------------------------------------------------
# Boot banner — MUST be the first log line of any process
# ---------------------------------------------------------------------------
_LOGGED = False


def log_network_mode(network: Optional[str] = None) -> str:
    """Emit the mandatory network-mode banner and return it as a string.

    Format (per spec):
        [NETWORK_MODE]: {ACTIVE_NETWORK} | [RPC]: {SELECTED_RPC_URL}

    Idempotent within a process (only prints once) but always returns the
    banner so callers can log it themselves if they want.
    """
    global _LOGGED
    cfg = get_config(network)
    selected = cfg.rpc_urls[0] if cfg.rpc_urls else "<NO RPC CONFIGURED>"
    banner = f"[NETWORK_MODE]: {cfg.name} | [RPC]: {selected}"
    if not _LOGGED:
        # Red-level visibility: print + log
        print(banner, flush=True)
        logger.warning("NETWORK MODE ACTIVE -> %s", cfg.describe())
        if cfg.is_mainnet:
            logger.warning(
                "==> WARNING: OPERATING ON MAINNET (chain %s) <==", cfg.chain_id
            )
        _LOGGED = True
    return banner


# Auto-emit the banner at import time so ANY module that imports network_config
# immediately reveals which chain it is about to touch.
try:
    log_network_mode()
except Exception as exc:  # never let config logging crash a process
    print(f"[NETWORK_MODE]: <config error: {exc}>", flush=True)
