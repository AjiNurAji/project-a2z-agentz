# 03. Agent B (The Vault)

**Agent B** is the on-chain execution engine of A2Z Agentz. It consumes scored tokens from Agent A, runs GoPlus security checks, and executes **DEX swaps** on **Base Network** via **Uniswap V2** — including automated **take-profit selling**.

Agent B runs as a **continuous asyncio daemon** (not a cron job), polling the `scraping_queue` every 2 seconds.

## 1. Execution Flow

```
scraping_queue → GoPlus security gate → Agent A score trust → DEX swap (buy) → held_tokens → take-profit monitor → DEX swap (sell)
```

### Step-by-step:

1. **Poll**: `SELECT ... FOR UPDATE SKIP LOCKED` from `scraping_queue` (pending tasks)
2. **GoPlus Security Check**: queries GoPlus Token Security API for:
   - Honeypot detection
   - Buy/sell tax percentage
   - Ownership risks (hidden owner, can take back ownership)
   - Holder concentration, mintable, proxy status
3. **Score Decision**: uses `max(Agent B score, Agent A score)` — trusts Agent A's data-driven scoring
4. **Security Gate**: blocks execution if ANY of:
   - `is_honeypot = true` → BLOCKED
   - `buy_tax > 10% or sell_tax > 10%` → BLOCKED
   - `can_take_back_ownership + hidden_owner` → BLOCKED
5. **DEX Swap (Buy)**: if score ≥ 60 and GoPlus clean → `swap_eth_for_token()` via Uniswap V2
6. **Track Purchase**: records to `held_tokens` table (address, entry price, amount, tx hash)
7. **Take-Profit Monitor**: polls DexScreener for current price every cycle
8. **Auto-Sell**: if profit ≥ `AGENT_B_PROFIT_PCT` (default 30%) → `swap_token_for_eth()` + mark sold

## 2. DEX Execution

### Buy Side: `swap_eth_for_token()`
- **Router**: Uniswap V2 on Base (`0x4752ba5D...`)
- **Function**: `swapExactETHForTokensSupportingFeeOnTransferTokens`
- **Path**: WETH → token
- **Amount**: $0.50 micro-trade (configurable)
- **Gas**: EIP-1559 type-2, max 300k gas, fee cap from env
- **Slippage**: amountOutMin = 1 wei (micro amount)

### Sell Side: `swap_token_for_eth()`
- **Step 1**: `approve()` — ERC20 approval for Uniswap router
- **Step 2**: `swapExactTokensForETHSupportingFeeOnTransferTokens`
- **Path**: token → WETH
- **Trigger**: profit ≥ `AGENT_B_PROFIT_PCT` (default 30%)
- **Broadcast**: "TAKE PROFIT" event to dashboard WebSocket

## 3. Multi-RPC Resilience

- **Up to 3 RPC endpoints**: `BASE_RPC_1`, `BASE_RPC_2`, `BASE_RPC_3`
- **Retry with exponential backoff**: 3 attempts (3s, 6s, 9s)
- **No infinite retry**: if `_build_rpc_provider()` returns None → FAILED with `retry=False`
- **Hardcoded threshold**: `MAX_SCORE_FOR_AUTO = 60` (no env override)

## 4. Database Tables

| Table | Purpose |
|---|---|
| `scraping_queue` | Task queue between Agent A → Agent B |
| `synthesis_results` | Agent B scoring results |
| `transaction_proposals` | Execution proposals |
| `execution_logs` | On-chain transaction history (powers `/api/stats`) |
| `held_tokens` | Buy tracking for take-profit (address, entry price, status) |
| `audit_log` | Full pipeline audit trail |

## 5. Vault Holdings Dashboard

Endpoint: `GET /api/holdings`

Returns:
```json
{
  "holding": [{ "token_address": "0x...", "token_name": "...", "entry_price_usd": 0.50, ... }],
  "sold": [{ "token_address": "0x...", "sell_tx_hash": "0x...", ... }],
  "count_holding": 2,
  "count_sold": 1
}
```

Frontend displays on Agents page with BaseScan links.

## 6. Configuration

| Env Variable | Default | Purpose |
|---|---|---|
| `AGENT_B_REAL_EXECUTION` | `0` | Set to `1` for real on-chain swaps |
| `AGENT_B_PROFIT_PCT` | `30` | Take-profit percentage target |
| `MAX_SCORE_FOR_AUTO` | `60` | Minimum score for execution (hardcoded) |
| `MAX_TX_AMOUNT_USD` | `2.0` | Per-tx USD cap |
| `MAX_GAS_PRICE_GWEI` | `5` | Gas fee cap |
| `VAULT_ADDRESS` | (required) | Vault wallet address |
| `PRIVATE_KEY` | (required) | Vault signing key |
| `BASE_RPC_1/2/3` | (required) | Base mainnet RPC endpoints |
