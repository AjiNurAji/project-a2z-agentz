"""P-Opsi1: Guest Demo Mode — hardcoded mock data.

Served ONLY when the caller is the guest sentinel (__guest__). No database
writes ever touch these rows; they are pure in-memory fixtures so the demo
UI looks 100% real without touching any real user's data.
"""
from __future__ import annotations

# Static, realistic-looking demo portfolio ($10,000 notional).
GUEST_PORTFOLIO = {
    "total_usd": 10000.00,
    "network": "mainnet",
    "holding": [
        {
            "token_name": "PEPE",
            "token_address": "0x6982508145454Ce325dDbE47a25d4ec3d69b0777",
            "amount": "12,400,000",
            "entry_price_usd": 0.0000012,
            "current_price_usd": 0.0000014,
            "pnl_pct": 16.6,
        },
        {
            "token_name": "DOGE",
            "token_address": "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9",
            "amount": "3,200",
            "entry_price_usd": 0.12,
            "current_price_usd": 0.135,
            "pnl_pct": 12.5,
        },
        {
            "token_name": "WOJAK",
            "token_address": "0x6aD3aC9E3190536F3a47bDff3fCCB3fd9B2ad77f",
            "amount": "890,000",
            "entry_price_usd": 0.00004,
            "current_price_usd": 0.000038,
            "pnl_pct": -5.0,
        },
    ],
}

# Pre-filled Smart Orders table (mix of Executed + Pending) for the demo.
GUEST_SMART_ORDERS = [
    {
        "id": 101,
        "token_name": "PEPE",
        "token_address": "0x6982508145454Ce325dDbE47a25d4ec3d69b0777",
        "target_entry_usd": 0.0000011,
        "status": "EXECUTED",
        "source": "llm",
        "executed_price_usd": 0.00000108,
    },
    {
        "id": 102,
        "token_name": "BONK",
        "token_address": "0x1B4b3b4f2E6d4Ae2B5a5e5e5E5e5E5e5E5e5E5e5",
        "target_entry_usd": 0.000023,
        "status": "PENDING",
        "source": "llm",
        "executed_price_usd": None,
    },
    {
        "id": 103,
        "token_name": "TURBO",
        "token_address": "0x6C0b9bA4eB8C7f1e3a8c0E5e5E5e5E5e5E5e5E5e",
        "target_entry_usd": 0.00061,
        "status": "EXECUTED",
        "source": "llm",
        "executed_price_usd": 0.00059,
    },
]

GUEST_SETTINGS = {
    "auto_sell_enabled": True,
    "execution_mode": "custodial",
}

# Mock dashboard stats for the demo (no real aggregation).
GUEST_STATS = {
    "total_transactions": 1287,
    "total_volume_usd": 64250.0,
    "active_agents": 2,
    "avg_pnl_pct": 9.4,
    "demo": True,
}
