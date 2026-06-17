from web3 import Web3
import os
import json
import time
from dotenv import load_dotenv

class ExecutorVault:
    """
    Web3 executed vault implementing direct on-chain execution capabilities
    for the A2Z trading agent system.
    """
    def __init__(self, rpc_endpoint):
        """Initialize RPC provider connection to Base Network"""
        self.w3 = Web3(Web3.HTTPProvider(rpc_endpoint))
        self.basechain_id = 8453

    def load_private_key(self, env_var_name="PRIVATE_KEY"):
        """Safely load private key from environment"""
        load_dotenv() # Load from .env if not set globally
        private_key = os.getenv(env_var_name)
        if not private_key:
            raise ValueError(f"No private key found in {env_var_name}")
        return private_key

    def send_transaction(self, tx_params):
        """Send ETH or contract interaction transaction"""
        private_key = self.load_private_key()
        account = self.w3.eth.account.from_key(private_key)
        tx = tx_params.copy()
        tx.update({
            "chainId": self.basechain_id,
            "nonce": self.w3.eth.get_transaction_count(account.address)
        })
        signed_tx = self.w3.eth.account.sign_transaction(tx, private_key)
        tx_hash = self.w3.eth.send_raw_transaction(signed_tx.raw_transaction)
        return tx_hash.hex()

    @classmethod
    def get_contract(cls, address, abi):
        """Contract factory method"""
        return cls.w3.eth.contract(address=address, abi=abi)

    def listen_for_tasks(self, task_filepath="tasks.json", poll_interval=1.0):
        """
        Simple task listener for A2A (Agent-to-Agent) workflow.

        Polls `task_filepath` for new transaction instructions from Agent A and
        automatically executes them via `send_transaction` until an explicit stop
        signal is encountered.

        Expected JSON structure:
        {
          "tasks": [
            {
              "task_id": "...",
              "status": "pending" | "processing" | "done" | "error",
              "tx_params": {
                "to": "0x...",
                "value": web3.to_wei(0.01, "ether"),
                "gas": 21000,
                "gasPrice": web3.to_wei("50", "gwei"),
                "data": "0x..."
              }
            }
          ],
          "meta": {
            "loop": "run" | "stop"
          }
        }
        """
        if not os.path.exists(task_filepath):
            raise FileNotFoundError(
                f"Task file not found: {task_filepath}. "
                "Agent A must create this file before polling."
            )

        while True:
            try:
                with open(task_filepath, "r") as f:
                    payload = json.load(f)

                meta = payload.get("meta", {})
                if meta.get("loop") == "stop":
                    print("[Listener] Stop signal received. Exiting polling loop.")
                    break

                tasks = payload.get("tasks", [])
                updated = False

                for task in tasks:
                    if task.get("status") != "pending":
                        continue

                    task_id = task.get("task_id", "unknown")
                    print(f"[Listener] Processing task '{task_id}'...")
                    task["status"] = "processing"
                    updated = True

                    try:
                        tx_params = task.get("tx_params")
                        if not tx_params:
                            raise ValueError("Missing 'tx_params' in task.")

                        tx_hash = self.send_transaction(tx_params)
                        task["tx_hash"] = tx_hash
                        task["status"] = "done"
                        print(
                            f"[Listener] Task '{task_id}' executed. "
                            f"Tx hash: {tx_hash}"
                        )
                    except Exception as exc:  # noqa: BLE001
                        task["status"] = "error"
                        task["error"] = str(exc)
                        print(
                            f"[Listener] Task '{task_id}' failed: {exc}"
                        )
                    updated = True

                if updated:
                    with open(task_filepath, "w") as f:
                        json.dump(payload, f, indent=2)

                time.sleep(poll_interval)

            except FileNotFoundError:
                print(
                    f"[Listener] {task_filepath} disappeared mid-run. "
                    "Waiting for it to reappear..."
                )
                time.sleep(poll_interval)
            except json.JSONDecodeError as exc:
                print(f"[Listener] Invalid JSON in {task_filepath}: {exc}")
                time.sleep(poll_interval)
