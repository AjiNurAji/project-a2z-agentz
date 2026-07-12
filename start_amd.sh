#!/usr/bin/env bash
#
# start_amd.sh — AMD MI300X vLLM launcher + Cloudflare tunnel keeper
# Project: A2Z Agentz (Track 3: Unicorn)
# Run this on the AMD GPU pod (JupyterLab terminal / SSH).
#
# What it does:
#   1. Kills any existing vLLM serve process
#   2. Launches vLLM with AWQ 4-bit, Llama-3.1-8B (fast local scoring,
#      ~5-10s on MI300X), max-model-len 2048 (faster prefill),
#      --max-num-seqs 1 (no batching contention), prefix caching enabled
#   3. Checks if the Cloudflare tunnel is still alive; if not, starts a new one
#   4. Prints the live tunnel URL you must paste into Railway AI_ENDPOINT
#
# NOTE: every restart of `cloudflared tunnel --url` generates a NEW random
#       subdomain. If the tunnel was restarted, update AI_ENDPOINT in Railway.
#
set -u

VLLM_LOG="$HOME/vllm.log"
TUNNEL_LOG="$HOME/tunnel.log"
API_KEY="adminteam46"
MODEL="meta-llama/Llama-3.1-8B-Instruct-AWQ"
PORT=8080

echo "=== [1/4] Killing old vLLM (if any) ==="
pkill -f "vllm serve" 2>/dev/null && echo "old vLLM killed" || echo "no old vLLM running"
sleep 2

echo "=== [2/4] Launching vLLM (Llama-3.1-8B AWQ, max-model-len 2048) ==="
nohup vllm serve "$MODEL" \
  --host 127.0.0.1 \
  --port "$PORT" \
  --quantization awq \
  --gpu-memory-utilization 0.95 \
  --max-model-len 2048 \
  --max-num-seqs 1 \
  --enable-prefix-caching \
  --api-key "$API_KEY" \
  > "$VLLM_LOG" 2>&1 &
echo "vLLM launching in background. Log: $VLLM_LOG"
echo "Expected startup time: ~18 min. Watch with: tail -f $VLLM_LOG"

echo "=== [3/4] Checking Cloudflare tunnel ==="
if pgrep -f "cloudflared tunnel" >/dev/null 2>&1; then
  echo "tunnel already alive — URL unchanged, no Railway update needed."
  TUNNEL_URL=$(grep -o 'https://[a-z0-9]*\.trycloudflare\.com' "$TUNNEL_LOG" 2>/dev/null | head -1)
  echo "Current tunnel URL: ${TUNNEL_URL:-<not found in log, check $TUNNEL_LOG>}"
else
  echo "tunnel NOT running — starting a new one (NEW random subdomain)."
  nohup cloudflared tunnel --url "http://127.0.0.1:$PORT" > "$TUNNEL_LOG" 2>&1 &
  sleep 5
  TUNNEL_URL=$(grep -o 'https://[a-z0-9]*\.trycloudflare\.com' "$TUNNEL_LOG" 2>/dev/null | head -1)
  echo "NEW tunnel URL: ${TUNNEL_URL:-<not ready yet, re-run grep after 5s>}"
  echo ">>> ACTION REQUIRED: update AI_ENDPOINT in Railway to: ${TUNNEL_URL}/v1"
fi

echo ""
echo "=== [4/4] Quick health check (after startup completes) ==="
echo "Run this once vLLM log shows 'Application startup complete':"
echo ""
echo "curl -s http://127.0.0.1:$PORT/v1/chat/completions \\"
echo "  -H \"Authorization: Bearer $API_KEY\" \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"model\":\"$MODEL\",\"messages\":[{\"role\":\"user\",\"content\":\"score 1-100: a verified audited DeFi protocol on Base with \$5M TVL\"}],\"max_tokens\":200,\"temperature\":0}' \\"
echo "  -w \"\\nTIME: %{time_total}s\\n\""
echo ""
echo "If TIME > 25s, options: lower --max-model-len to 2048, or use a smaller model."
