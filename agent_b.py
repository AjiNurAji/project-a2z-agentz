from web3 import Web3
import os
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
        tx_hash = self.w3.eth.send_raw_transaction(signed_tx.rawTransaction)
        return tx_hash.hex()

    @classmethod
    def get_contract(cls, address, abi):
        """Contract factory method"""
        return cls.w3.eth.contract(address=address, abi=abi)
