"""
Agent A - The Scout
Web3 OSINT Analyst for A2Z Agentz
Scans Farcaster social data, analyzes on-chain metrics, identifies high-value opportunities on Base network
"""

import os
import asyncio
import aiohttp
from aiohttp import ClientTimeout
from typing import Dict, Any, List, Optional
from dotenv import load_dotenv

from db_pipeline import create_pool, insert_to_queue, insert_to_blacklist

load_dotenv()

# Environment variables
NEYNAR_API_KEY = os.getenv("NEYNAR_API_KEY")
AGENT_A_ENDPOINT = os.getenv("AGENT_A_ENDPOINT")
AGENT_A_MODEL = os.getenv("AGENT_A_MODEL")
AGENT_A_API_KEY = os.getenv("AGENT_A_API_KEY")
BATCH_SIZE = int(os.getenv("BATCH_SIZE", 50))

# Agent Identity
SYSTEM_PROMPT = """You are Agent A (The Scout), an expert Web3 OSINT Analyst. Your skill is to scan Farcaster social data, analyze on-chain metrics, and identify high-value opportunities on the Base network — specifically free mints, token launches, and airdrop claims. You synthesize signals from multiple sources into a structured risk score."""

OPPORTUNITY_KEYWORDS = [
    "base network", "airdrop", "defi", "base",
    "new token base", "just deployed base",
    "mint live base", "fair launch base",
    "stealth launch", "farcaster miniapp",
    "base miniapp", "buildathon base",
    "early base", "base gem", "100x base",
    "base alpha", "low cap base", "mint now base",
    "claim airdrop", "whitelist base", "free mint base"
]

WARNING_KEYWORDS = [
    "rug base", "scam base", "honeypot base",
    "avoid base", "rugpull", "do not buy",
    "warned base", "flagged base",
    "drain wallet", "fake airdrop"
]


def check_keyword_match(text: str, keywords: List[str]) -> Optional[str]:
    """Check if any keyword matches in the text (case-insensitive)"""
    if not text:
        return None
    text_lower = text.lower()
    for keyword in keywords:
        if keyword.lower() in text_lower:
            return keyword
    return None


async def fetch_from_dexscreener(session: aiohttp.ClientSession, timeout: ClientTimeout) -> List[Dict[str, Any]]:
    """
    Fetch token data from DexScreener
    GET https://api.dexscreener.com/latest/dex/search?q=base
    """
    try:
        url = "https://api.dexscreener.com/latest/dex/search"
        params = {"q": "base"}
        
        async with session.get(url, params=params, timeout=timeout) as response:
            if response.status == 200:
                data = await response.json()
                pairs = data.get("pairs", [])
                
                tokens = []
                for pair in pairs[:BATCH_SIZE]:
                    token_info = pair.get("baseToken", {})
                    tokens.append({
                        "token_name": token_info.get("name", "Unknown"),
                        "contract_address": token_info.get("address", ""),
                        "volume_24h": pair.get("volume", {}).get("h24", 0),
                        "price_change_24h": pair.get("priceChange", {}).get("h24", 0),
                        "market_cap": pair.get("marketCap", 0),
                        "liquidity_usd": pair.get("liquidity", {}).get("usd", 0)
                    })
                
                print(f"📊 DexScreener: fetched {len(tokens)} tokens")
                return tokens
            else:
                print(f"⚠️ DexScreener API returned status {response.status}")
                return []
                
    except Exception as e:
        print(f"⚠️ DexScreener fetch failed: {e}")
        return []


async def fetch_social_signals(session: aiohttp.ClientSession, timeout: ClientTimeout, token_name: str) -> List[str]:
    """
    Fetch social signals from Neynar Farcaster API
    GET https://api.neynar.com/v2/farcaster/cast/search
    """
    if not NEYNAR_API_KEY:
        print("⚠️ Neynar API key missing — social_signals = []")
        return []
    
    try:
        url = "https://api.neynar.com/v2/farcaster/cast/search"
        headers = {"api_key": NEYNAR_API_KEY}
        params = {"q": token_name, "limit": 5}
        
        async with session.get(url, headers=headers, params=params, timeout=timeout) as response:
            if response.status == 200:
                data = await response.json()
                casts = data.get("casts", [])
                social_signals = [cast.get("text", "") for cast in casts]
                print(f"💬 Neynar: found {len(social_signals)} casts for {token_name}")
                return social_signals
            else:
                print(f"⚠️ Neynar API returned status {response.status} for {token_name}")
                return []
                
    except Exception as e:
        print(f"⚠️ Neynar fetch failed for {token_name}: {e}")
        return []


async def check_contract_verification(session: aiohttp.ClientSession, timeout: ClientTimeout, contract_address: str) -> bool:
    """
    Check contract verification on Basescan
    GET https://api.basescan.org/api?module=contract&action=getsourcecode&address={address}
    """
    try:
        url = "https://api.basescan.org/api"
        params = {
            "module": "contract",
            "action": "getsourcecode",
            "address": contract_address
        }
        
        async with session.get(url, params=params, timeout=timeout) as response:
            if response.status == 200:
                data = await response.json()
                result = data.get("result", [{}])
                if result and isinstance(result, list):
                    source_code = result[0].get("SourceCode", "")
                    is_verified = source_code != ""
                    return is_verified
            return False
            
    except Exception as e:
        print(f"⚠️ Basescan verification check failed for {contract_address}: {e}")
        return False


async def fetch_market_data(session: aiohttp.ClientSession, timeout: ClientTimeout, contract_address: str) -> Dict[str, Any]:
    """
    Fetch market data from CoinGecko
    GET https://api.coingecko.com/api/v3/coins/base/contract/{contract_address}
    """
    try:
        url = f"https://api.coingecko.com/api/v3/coins/base/contract/{contract_address}"
        
        async with session.get(url, timeout=timeout) as response:
            if response.status == 200:
                data = await response.json()
                market_data = data.get("market_data", {})
                return {
                    "market_cap": market_data.get("market_cap", {}).get("usd"),
                    "coingecko_id": data.get("id")
                }
            else:
                return {"market_cap": None, "coingecko_id": None}
                
    except Exception as e:
        print(f"⚠️ CoinGecko fetch failed for {contract_address}: {e}")
        return {"market_cap": None, "coingecko_id": None}


async def get_ai_score(
    session: aiohttp.ClientSession,
    timeout: ClientTimeout,
    context: str
) -> tuple[int, str, str]:
    """
    Get AI risk score from Agent A endpoint
    Returns: (score, reason, risk_flags)
    """
    if not AGENT_A_API_KEY or not AGENT_A_ENDPOINT:
        print("⚠️ Agent A BYPASS — mock score used")
        return (85, "High Farcaster engagement, verified contract", "None")
    
    try:
        payload = {
            "model": AGENT_A_MODEL,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": context}
            ]
        }
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {AGENT_A_API_KEY}"
        }
        
        async with session.post(
            AGENT_A_ENDPOINT,
            json=payload,
            headers=headers,
            timeout=timeout
        ) as response:
            if response.status == 200:
                data = await response.json()
                # Parse score from response (adjust based on actual API format)
                score = data.get("choices", [{}])[0].get("message", {}).get("content", "85")
                # Try to extract numeric score
                try:
                    score = int(''.join(filter(str.isdigit, str(score))) or "85")
                except:
                    score = 85
                return (
                    min(100, max(0, score)),
                    "AI-analyzed opportunity",
                    "None"
                )
            else:
                print(f"⚠️ Agent A API returned status {response.status}")
                return (85, "High Farcaster engagement, verified contract", "None")
                
    except Exception as e:
        print(f"⚠️ Agent A API call failed: {e}")
        return (85, "High Farcaster engagement, verified contract", "None")


async def process_token(
    session: aiohttp.ClientSession,
    timeout: ClientTimeout,
    pool,
    token: Dict[str, Any]
) -> tuple[str, int, int, int]:
    """
    Process a single token through the full pipeline
    Returns: (status: 'queued'/'blacklisted'/'skipped', score, blacklisted_count, skipped_count)
    """
    token_name = token["token_name"]
    contract_address = token["contract_address"]
    
    if not contract_address:
        print(f"⏭️ SKIPPED: {token_name} — no contract address")
        return ("skipped", 0, 0, 1)
    
    try:
        # Enrich with multiple data sources
        social_signals = await fetch_social_signals(session, timeout, token_name)
        is_verified = await check_contract_verification(session, timeout, contract_address)
        market_data = await fetch_market_data(session, timeout, contract_address)
        
        # Build full social context
        full_social_text = " ".join(social_signals)
        
        # Check WARNING keywords first
        warning_match = check_keyword_match(full_social_text, WARNING_KEYWORDS)
        if warning_match:
            print(f"⛔ BLACKLISTED: {token_name} — {warning_match}")
            await insert_to_blacklist(pool, contract_address, token_name, f"Warning keyword: {warning_match}")
            return ("blacklisted", 0, 1, 0)
        
        # Check OPPORTUNITY keywords
        opportunity_match = check_keyword_match(full_social_text, OPPORTUNITY_KEYWORDS)
        if not opportunity_match:
            print(f"⏭️ SKIPPED: {token_name} — no signal match")
            return ("skipped", 0, 0, 1)
        
        # Build AI context
        context = f"""Token: {token_name} | Address: {contract_address}
Volume 24h: ${token['volume_24h']:,.2f} | Price change: {token['price_change_24h']:+.2f}%
Verified: {is_verified} | Market cap: ${market_data['market_cap'] if market_data['market_cap'] else 'N/A'}
Social signals: {full_social_text[:500] if full_social_text else 'None'}"""
        
        # Get AI score
        score, reason, risk_flags = await get_ai_score(session, timeout, context)
        
        # Build payload for Agent B
        payload = {
            "token_name": token_name,
            "contract_address": contract_address,
            "volume_24h": token["volume_24h"],
            "price_change_24h": token["price_change_24h"],
            "market_cap": market_data["market_cap"],
            "is_verified": is_verified,
            "social_signals": social_signals,
            "ai_score": score,
            "ai_reason": reason,
            "risk_flags": risk_flags,
            "source": "agent_a_scout"
        }
        
        # Insert to queue
        inserted = await insert_to_queue(pool, payload, contract_address, token_name)
        
        if inserted:
            print(f"📡 Scout queued: {token_name} | score: {score} | address: {contract_address}")
            return ("queued", score, 0, 0)
        else:
            return ("skipped", score, 0, 1)
            
    except Exception as e:
        print(f"⚠️ Failed to process {token_name}: {e}")
        return ("skipped", 0, 0, 1)


async def scout_cycle():
    """Run a single scout cycle"""
    pool = None
    try:
        pool = await create_pool()
        timeout = ClientTimeout(total=10)
        
        async with aiohttp.ClientSession() as session:
            # Fetch tokens from DexScreener
            tokens = await fetch_from_dexscreener(session, timeout)
            
            if not tokens:
                print("⚠️ No tokens fetched from DexScreener")
                return
            
            # Process each token
            queued = 0
            blacklisted = 0
            skipped = 0
            
            for token in tokens:
                status, score, black_count, skip_count = await process_token(session, timeout, pool, token)
                
                if status == "queued":
                    queued += 1
                elif status == "blacklisted":
                    blacklisted += black_count
                else:
                    skipped += skip_count
            
            # Print cycle summary
            print(f"\n📊 Scout cycle done: {queued}/{len(tokens)} queued | {blacklisted} blacklisted | {skipped} skipped\n")
            
    except Exception as e:
        print(f"⚠️ Scout cycle failed: {e}")
    finally:
        if pool:
            await pool.close()


async def main():
    """Main loop - run every 15 minutes"""
    print("🚀 Agent A (The Scout) starting...")
    print(f"🔍 Scanning every 15 minutes | Batch size: {BATCH_SIZE}")
    
    while True:
        print("\n" + "="*60)
        print("📡 Starting new scout cycle")
        print("="*60)
        
        await scout_cycle()
        
        print("⏳ Waiting 15 minutes until next cycle...")
        await asyncio.sleep(900)


if __name__ == "__main__":
    asyncio.run(main())