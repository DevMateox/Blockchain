import hashlib
from web3 import Web3
from django.conf import settings

def generate_sha256(file) -> str:
    sha256_hash = hashlib.sha256()
    for chunk in file.chunks():
        sha256_hash.update(chunk)
    return "0x" + sha256_hash.hexdigest()

def get_w3():
    print("SEPOLIA_RPC:", settings.SEPOLIA_RPC)
    w3 = Web3(Web3.HTTPProvider(settings.SEPOLIA_RPC))
    if not w3.is_connected():
        raise Exception("Error de conexión con Sepolia")
    print("Conectado a Sepolia")
    return w3

def store_hash_on_blockchain(hash_str: str) -> str:
    w3 = get_w3()

    balance = w3.eth.get_balance(settings.ADDRESS)
    if balance < 10**15:
        raise Exception("Fondos insuficientes en la wallet")

    nonce = w3.eth.get_transaction_count(settings.ADDRESS)
    gas_price = w3.eth.gas_price

    print("HASH a guardar:", hash_str)

    tx_dict = {
        "nonce": nonce,
        "to": settings.ADDRESS,
        "value": 0,
        "gas": 2000000,
        "gasPrice": gas_price,
        "data": hash_str.encode("utf-8"),
        "chainId": 11155111,
    }

    signed = w3.eth.account.sign_transaction(tx_dict, settings.PRIVATE_KEY)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)

    print("Esperando confirmación de transacción...")
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)

    final_hash = "0x" + receipt["transactionHash"].hex()
    print("Transacción enviada:", final_hash)
    print("Ver en Etherscan: https://sepolia.etherscan.io/tx/" + final_hash)

    return final_hash

def verify_hash_on_blockchain(tx_hash: str) -> str:
    try:
        w3 = get_w3()
        tx = w3.eth.get_transaction(tx_hash)
    except Exception as e:
        print(f"No se pudo obtener la transacción {tx_hash}: {e}")
        return ""

    data_hex = tx.get("input", "")
    if not data_hex or data_hex == "0x":
        print("No hay datos en la transacción (input vacío).")
        return ""

    if isinstance(data_hex, bytes):
        data_hex = data_hex.hex()
    elif not isinstance(data_hex, str):
        data_hex = str(data_hex)

    if data_hex.startswith("0x"):
        data_hex = data_hex[2:]

    try:
        stored_bytes = bytes.fromhex(data_hex)
        stored_hash = stored_bytes.decode("utf-8", errors="ignore").strip("\x00")
    except Exception as e:
        print(f"Error decodificando data de la transacción: {e}")
        return ""

    print("📦 Hash encontrado en blockchain:", stored_hash)
    return stored_hash
