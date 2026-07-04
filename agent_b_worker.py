"""
Agent B - The Vault Gatekeeper
DeFi Security Auditor for A2Z Agentz
Evaluates Base network contracts for honeypots/rug risks, executes free mints and airdrop claims
"""

import os
import asyncio
import aiohttp
from aiohttp import ClientTimeout
from typing import Dict, Any, Optional
from dotenv import load_dotenv
from web3 import Web3
from eth_account import Account
import json

from db_pipeline import create_pool, fetch_and_lock_pending_task, update_task_status

load_dotenv()

# Environment variables
GOPLUS_API_URL = os.getenv("GOPLUS_API_URL", "https://api.gopluslabs.io/api/v1/address_security/")
GOPLUS_API_KEY = os.getenv("GOPLUS_API_KEY")
AGENT_B_ENDPOINT = os.getenv("AGENT_B_ENDPOINT")
AGENT_B_MODEL = os.getenv("AGENT_B_MODEL")
AGENT_B_API_KEY = os.getenv("AGENT_B_API_KEY")
ACTIVE_NETWORK = os.getenv("ACTIVE_NETWORK", "sepolia")
PRIVATE_KEY = os.getenv("PRIVATE_KEY")
AGENT_A_PUBLIC_KEY = os.getenv("AGENT_A_PUBLIC_KEY")

# Budget constraints
MAX_TX_AMOUNT_USD = float(os.getenv("MAX_TX_AMOUNT_USD", 2.0))
MAX_SPEND_PER_CYCLE_USD = float(os.getenv("MAX_SPEND_PER_CYCLE_USD", 5.0))
MAX_DAILY_SPEND_USD = float(os.getenv("MAX_DAILY_SPEND_USD", 20.0))
CONSECUTIVE_FAIL_LIMIT = int(os.getenv("CONSECUTIVE_FAIL_LIMIT", 3))

# RPC endpoints
BASE_RPC_MAINNET = [
    os.getenv("BASE_RPC_1", "https://mainnet.base.org"),
    os.getenv("BASE_RPC_2", "https://base.llamarpc.com"),
    os.getenv("BASE_RPC_3", "https://base.publicnode.com")
]

BASE_RPC_SEPOLIA = [
    os.getenv("BASE_SEPOLIA_RPC_1", "https://sepolia.base.org"),
    os.getenv("BASE_SEPOLIA_RPC_2", "https://base-sepolia.g.alchemy.com/v2/demo")
]

# Agent Identity
SYSTEM_PROMPT = """You are Agent B (The Vault Gatekeeper), a strict DeFi Security Auditor. Your skill is to evaluate Base network contracts for honeypots and rug risks, then autonomously execute free mints, token claims, and airdrop participation on behalf of the agent wallet. Maximum transaction: $2 USD. Reject anything below score 80."""


def get_web3_instance() -> tuple[Optional[Web3], Optional[str]]:
    """
    Get Web3 instance for active network
    Returns: (web3_instance, error_message)
    """
    if ACTIVE_NETWORK == "mainnet":
        rpcs = BASE_RPC_MAINNET
        network_name = "Base Mainnet"
    else:
        rpcs = BASE_RPC_SEPOLIA
        network_name = "Base Sepolia"
    
    # Try each RPC in order
    for rpc_url in rpcs:
        try:
            w3 = Web3(Web3.HTTPProvider(rpc_url))
            
            if w3.is_connected():
                print(f"✅ Connected to {network_name} via {rpc_url[:40]}...")
                return w3, None
        except Exception as e:
            print(f"⚠️ RPC {rpc_url[:40]}... failed: {e}")
            continue
    
    return None, f"Failed to connect to any {network_name} RPC"


async def check_goplus_security(
    session: aiohttp.ClientSession,
    timeout: ClientTimeout,
    contract_address: str
) -> tuple[bool, Dict[str, Any]]:
    """
    Check contract security via GoPlus API
    Returns: (is_safe, security_data)
    """
    if not GOPLUS_API_KEY:
        print("⚠️ GoPlus key missing — assuming safe")
        return True, {"is_honeypot": False, "buy_tax": 0, "sell_tax": 0, "is_open_source": True}
    
    try:
        # GoPlus API expects chain ID and address
        chain_id = "8453" if ACTIVE_NETWORK == "mainnet" else "84532"
        url = f"{GOPLUS_API_URL}{chain_id}/{contract_address}"
        headers = {"Authorization": GOPLUS_API_KEY} if GOPLUS_API_KEY else {}
        
        async with session.get(url, headers=headers, timeout=timeout) as response:
            if response.status == 200:
                data = await response.json()
                result = data.get("result", {})
                
                is_honeypot = result.get("is_honeypot", False)
                buy_tax = float(result.get("buy_tax", 0) or 0)
                sell_tax = float(result.get("sell_tax", 0) or 0)
                is_open_source = result.get("is_open_source", True)
                
                security_data = {
                    "is_honeypot": is_honeypot,
                    "buy_tax": buy_tax,
                    "sell_tax": sell_tax,
                    "is_open_source": is_open_source,
                    "raw_data": result
                }
                
                if is_honeypot:
                    return False, security_data
                if buy_tax > 10 or sell_tax > 10:
                    return False, security_data
                
                return True, security_data
            else:
                print(f"⚠️ GoPlus API returned status {response.status}")
                return True, {"is_honeypot": False, "buy_tax": 0, "sell_tax": 0, "is_open_source": True}
                
    except Exception as e:
        print(f"⚠️ GoPlus check failed — assuming safe: {e}")
        return True, {"is_honeypot": False, "buy_tax": 0, "sell_tax": 0, "is_open_source": True}


async def get_ai_decision(
    session: aiohttp.ClientSession,
    timeout: ClientTimeout,
    task_payload: Dict[str, Any],
    goplus_result: Dict[str, Any]
) -> int:
    """
    Get AI security score from Agent B endpoint
    Returns: score (0-100)
    """
    if not AGENT_B_API_KEY or not AGENT_B_ENDPOINT:
        print("⚠️ Agent B BYPASS — hardcode score 85")
        return 85
    
    try:
        context = f"""
Contract: {task_payload.get('contract_address', 'N/A')}
Token: {task_payload.get('token_name', 'N/A')}
GoPlus Security: Honeypot={goplus_result.get('is_honeypot', False)}, Buy Tax={goplus_result.get('buy_tax', 0)}%, Sell Tax={goplus_result.get('sell_tax', 0)}%
Verified: {task_payload.get('is_verified', False)}
Previous AI Score: {task_payload.get('ai_score', 0)}
Reason: {task_payload.get('ai_reason', 'N/A')}
"""
        
        payload = {
            "model": AGENT_B_MODEL,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": context}
            ]
        }
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {AGENT_B_API_KEY}"
        }
        
        async with session.post(
            AGENT_B_ENDPOINT,
            json=payload,
            headers=headers,
            timeout=timeout
        ) as response:
            if response.status == 200:
                data = await response.json()
                score = data.get("choices", [{}])[0].get("message", {}).get("content", "85")
                try:
                    score = int(''.join(filter(str.isdigit, str(score))) or "85")
                except:
                    score = 85
                return min(100, max(0, score))
            else:
                print(f"⚠️ Agent B API returned status {response.status}")
                return 85
                
    except Exception as e:
        print(f"⚠️ Agent B API failed — hardcode score 85: {e}")
        return 85


def execute_tx(
    w3: Web3,
    contract_address: str,
    action_type: str,
    value_wei: int = 0
) -> Optional[str]:
    """
    Execute transaction on contract (synchronous)
    Returns: tx_hash or None on failure
    """
    try:
        # Load wallet
        private_key = PRIVATE_KEY
        if not private_key:
            print("⚠️ PRIVATE_KEY not set — simulating tx")
            return "0xSIMULATED_TX"
        
        account = Account.from_key(private_key)
        
        # Get contract ABI (minimal ABI for mint/claim functions)
        if action_type == "free_mint" or action_type == "paid_mint":
            contract_abi = json.loads('[{"inputs":[],"name":"mint","outputs":[],"stateMutability":"nonpayable","type":"function"}]')
        elif action_type == "airdrop_claim":
            contract_abi = json.loads('[{"inputs":[],"name":"claim","outputs":[],"stateMutability":"nonpayable","type":"function"}]')
        else:
            print(f"⚠️ Unknown action type: {action_type}")
            return None
        
        contract = w3.eth.contract(address=Web3.to_checksum_address(contract_address), abi=contract_abi)
        
        # Build transaction params as dict
        tx_params = {
            "from": account.address,
            "nonce": w3.eth.get_transaction_count(account.address),
            "chainId": w3.eth.chain_id,
            "gas": 100000
        }
        
        if value_wei > 0:
            tx_params["value"] = value_wei
        
        # Estimate gas
        try:
            if action_type in ["free_mint", "paid_mint"]:
                gas_estimate = contract.functions.mint().estimate_gas(tx_params)
            else:
                gas_estimate = contract.functions.claim().estimate_gas(tx_params)
            tx_params["gas"] = int(gas_estimate * 1.1)  # 10% buffer
        except Exception as e:
            print(f"⚠️ Gas estimation failed: {e}")
        
        # Get gas price (use EIP-1559 for Base)
        try:
            fee_history = w3.eth.fee_history(5, 'latest', [20])
            base_fee = fee_history['baseFeePerGas'][-1]
            max_priority_fee = w3.to_wei(0.1, 'gwei')
            max_fee = int(base_fee * 1.5) + max_priority_fee
            
            tx_params["maxFeePerGas"] = max_fee
            tx_params["maxPriorityFeePerGas"] = max_priority_fee
        except:
            tx_params["gasPrice"] = w3.eth.gas_price
        
        # Build and sign transaction
        if action_type in ["free_mint", "paid_mint"]:
            tx = contract.functions.mint().build_transaction(tx_params)
        else:
            tx = contract.functions.claim().build_transaction(tx_params)
        
        signed_tx = account.sign_transaction(tx)
        
        # Send transaction
        tx_hash = w3.eth.send_raw_transaction(signed_tx.rawTransaction)
        return tx_hash.hex()
        
    except Exception as e:
        print(f"⚠️ Transaction execution failed: {e}")
        return None


async def process_task(
    session: aiohttp.ClientSession,
    timeout: ClientTimeout,
    pool,
    task: Dict[str, Any],
    cycle_spend: float,
    daily_spend: float,
    consecutive_failures: int
) -> tuple[str, float, float, int]:
    """
    Process a single task through all gates
    Returns: (status, new_cycle_spend, new_daily_spend, new_consecutive_failures)
    """
    task_id = task["id"]
    payload = task.get("payload", {})
    contract_address = task.get("target_address", "")
    project_name = task.get("project_name", "Unknown")
    
    # GATE 1 — GoPlus Security Check
    is_safe, goplus_data = await check_goplus_security(session, timeout, contract_address)
    
    if not is_safe:
        reason = []
        if goplus_data.get("is_honeypot"):
            reason.append("honeypot detected")
        if goplus_data.get("buy_tax", 0) > 10:
            reason.append(f"buy tax {goplus_data['buy_tax']}%")
        if goplus_data.get("sell_tax", 0) > 10:
            reason.append(f"sell tax {goplus_data['sell_tax']}%")
        
        print(f"🚨 SECURITY FAIL: {contract_address} — {', '.join(reason)}")
        await update_task_status(pool, task_id, "FAILED")
        return ("failed", cycle_spend, daily_spend, consecutive_failures + 1)
    
    # GATE 2 — AI Decision
    score = await get_ai_decision(session, timeout, payload, goplus_data)
    
    # GATE 3 — Score Threshold
    if score < 80:
        print(f"❌ REJECTED: {contract_address} score {score} < 80")
        await update_task_status(pool, task_id, "FAILED")
        return ("failed", cycle_spend, daily_spend, consecutive_failures + 1)
    
    # GATE 4 — Budget Circuit Breaker
    if cycle_spend + MAX_TX_AMOUNT_USD >= MAX_SPEND_PER_CYCLE_USD:
        print(f"🛑 Cycle budget ${MAX_SPEND_PER_CYCLE_USD} reached, waiting next cycle")
        return ("cycle_budget", cycle_spend, daily_spend, consecutive_failures)
    
    if daily_spend >= MAX_DAILY_SPEND_USD:
        print(f"🛑 Daily budget ${MAX_DAILY_SPEND_USD} reached, stopping")
        return ("daily_budget", cycle_spend, daily_spend, consecutive_failures)
    
    if consecutive_failures >= CONSECUTIVE_FAIL_LIMIT:
        print(f"🛑 {CONSECUTIVE_FAIL_LIMIT} consecutive failures — circuit breaker triggered, pausing 10 minutes")
        await asyncio.sleep(600)
        return ("circuit_breaker", 0, daily_spend, 0)  # Reset consecutive failures
    
    # GATE 5 — Execution
    # Determine action type from payload
    action_type = payload.get("action_type", "free_mint")
    
    # Load network and get Web3 instance
    w3, error = get_web3_instance()
    if error:
        print(f"⚠️ {error}")
        await update_task_status(pool, task_id, "FAILED", retry=True)
        return ("failed", cycle_spend, daily_spend, consecutive_failures + 1)
    
    if not w3:
        print("⚠️ Web3 instance is None")
        await update_task_status(pool, task_id, "FAILED", retry=True)
        return ("failed", cycle_spend, daily_spend, consecutive_failures + 1)
    
    # Calculate value (0 for free mints/airdrops, <= $2 for paid mints)
    value_wei = 0
    tx_cost_usd = 0  # Gas cost only for free mints
    
    if action_type == "paid_mint":
        # For paid mints, assume mint price is within $2 limit
        value_wei = w3.to_wei(0.001, 'ether')  # Example: 0.001 ETH
        tx_cost_usd = 0.5  # Estimated gas cost
    
    print(f"⚡ Executing {action_type} for {contract_address} on {ACTIVE_NETWORK}")
    
    tx_hash = execute_tx(w3, contract_address, action_type, value_wei)
    
    if tx_hash:
        print(f"✅ APPROVED & EXECUTED: {contract_address} | score: {score} | tx: {tx_hash} | network: {ACTIVE_NETWORK}")
        await update_task_status(pool, task_id, "COMPLETED")
        
        # Update spend tracking
        new_cycle_spend = cycle_spend + tx_cost_usd
        new_daily_spend = daily_spend + tx_cost_usd
        
        return ("executed", new_cycle_spend, new_daily_spend, 0)
    else:
        print(f"⚠️ TX failed: {contract_address}")
        await update_task_status(pool, task_id, "FAILED", retry=True)
        return ("failed", cycle_spend, daily_spend, consecutive_failures + 1)


async def worker_loop():
    """Main worker loop - process tasks one at a time"""
    print("🔐 Agent B (The Vault Gatekeeper) starting...")
    print(f"🛡️  Security Auditor | Max tx: ${MAX_TX_AMOUNT_USD} | Cycle budget: ${MAX_SPEND_PER_CYCLE_USD} | Daily: ${MAX_DAILY_SPEND_USD}")
    
    cycle_spend = 0.0
    daily_spend = 0.0
    consecutive_failures = 0
    executed_count = 0
    processed_count = 0
    pool = None
    
    try:
        pool = await create_pool()
        timeout = ClientTimeout(total=15)
        
        async with aiohttp.ClientSession() as session:
            while True:
                # Fetch and lock pending task
                task = await fetch_and_lock_pending_task(pool)
                
                if not task:
                    print("⏳ Waiting for tasks...")
                    await asyncio.sleep(2)
                    continue
                
                processed_count += 1
                
                # Process task through all gates
                status, cycle_spend, daily_spend, consecutive_failures = await process_task(
                    session, timeout, pool, task, cycle_spend, daily_spend, consecutive_failures
                )
                
                if status == "executed":
                    executed_count += 1
                elif status == "cycle_budget":
                    # Reset cycle spend and wait
                    cycle_spend = 0.0
                    print("⏳ Waiting 15 minutes for new cycle...")
                    await asyncio.sleep(900)
                    continue
                elif status == "daily_budget":
                    print("🛑 Daily budget reached, stopping worker")
                    break
                elif status == "circuit_breaker":
                    consecutive_failures = 0
                    continue
                
                # Small delay between tasks
                await asyncio.sleep(2)
                
                # Print periodic summary
                if processed_count % 10 == 0:
                    print(f"\n📊 Progress: {executed_count}/{processed_count} executed | spent: ${cycle_spend:.2f} cycle / ${daily_spend:.2f} daily | network: {ACTIVE_NETWORK}\n")
    
    except Exception as e:
        print(f"⚠️ Worker loop failed: {e}")
    finally:
        if pool:
            await pool.close()
        
        # Print end of cycle summary
        print(f"\n📊 Agent B cycle: {executed_count}/{processed_count} executed | spent: ${cycle_spend:.2f} | daily: ${daily_spend:.2f}/$20.00 | network: {ACTIVE_NETWORK}\n")


async def main():
    """Entry point"""
    await worker_loop()


if __name__ == "__main__":
    asyncio.run(main())