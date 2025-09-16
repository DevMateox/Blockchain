from django.shortcuts import render
from django.conf import settings
from django.http import JsonResponse
from .web3 import generate_sha256, store_hash_on_blockchain, verify_hash_on_blockchain
from .models import Documento, Verificacion
from web3 import Web3
from django.conf import settings
import hashlib
import datetime
from django.utils.timezone import localtime

def upload_document(request):
    if request.method == 'POST':
        try:
            if not request.FILES.get('document'):
                if request.headers.get('x-requested-with') == 'XMLHttpRequest':
                    return JsonResponse({'success': False, 'error': 'No se proporcionó ningún archivo'})
                return render(request, 'index.html')

            uploaded_file = request.FILES['document']
            file_hash = generate_sha256(uploaded_file)
            tx_hash, blockchain_time = store_hash_on_blockchain(file_hash)
            direccion_wallet = settings.ADDRESS

            documento = Documento.objects.create(
                nombre_del_archivo=uploaded_file.name,
                hash_archivo=file_hash,
                direccion_wallet=direccion_wallet,
                hash_transaccion=tx_hash
            )

            if request.headers.get('x-requested-with') == 'XMLHttpRequest':
               return JsonResponse({
            "success": True,
            "file_name": documento.nombre_del_archivo,
            "file_hash": documento.hash_archivo,
            "tx_hash": documento.hash_transaccion,
            "fecha_subida": blockchain_time.strftime("%d/%m/%Y %I:%M:%S %p"),
            "direccion_wallet": documento.direccion_wallet
        })

            return render(request, 'index.html', {
                'upload_success': True,
                'file_hash': file_hash,
                'tx_hash': tx_hash,
                'tx_link': f"https://sepolia.etherscan.io/tx/{tx_hash}",
                'documento': documento
            })

        except Exception as e:
            if request.headers.get('x-requested-with') == 'XMLHttpRequest':
                return JsonResponse({'success': False, 'error': f'Error: {str(e)}'})
            return render(request, 'index.html', {'upload_error': f'Error: {str(e)}'})

    return render(request, 'index.html')

# 👉 Función para generar hash SHA-256 del archivo
def generate_sha256(file):
    sha256_hash = hashlib.sha256()
    for chunk in file.chunks():
        sha256_hash.update(chunk)
    return '0x' + sha256_hash.hexdigest()

# 👉 Obtener instancia de Web3 conectada a Sepolia
def get_w3():
    print("SEPOLIA_RPC:", settings.SEPOLIA_RPC)
    w3 = Web3(Web3.HTTPProvider(settings.SEPOLIA_RPC))

    if not w3.is_connected():
        raise Exception("❌ Error de conexión con Sepolia")

    print("Conectado a Sepolia")
    return w3

# 👉 Almacenar hash en la blockchain y devolver el tx_hash real
def store_hash_on_blockchain(hash_str):
    w3 = get_w3()

    # Validar fondos
    balance = w3.eth.get_balance(settings.ADDRESS)
    if balance < 10**15:  # ~0.001 ETH
        raise Exception("Fondos insuficientes en la wallet")

    nonce = w3.eth.get_transaction_count(settings.ADDRESS)
    gas_price = w3.eth.gas_price

    print(" HASH a guardar:", hash_str)

    transaction = {
        'nonce': nonce,
        'to': settings.ADDRESS,
        'value': 0,
        'gas': 2000000,
        'gasPrice': gas_price,
        'data': hash_str.encode('utf-8'),
        'chainId': 11155111  # Sepolia chain ID
    }

    signed_txn = w3.eth.account.sign_transaction(transaction, settings.PRIVATE_KEY)
    tx_hash = w3.eth.send_raw_transaction(signed_txn.raw_transaction)

    print("Esperando confirmación de transacción...")
    tx_receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)

    final_hash = '0x' + tx_receipt['transactionHash'].hex()
    print("Transacción enviada:", final_hash)
    print("Ver en Etherscan: https://sepolia.etherscan.io/tx/" + final_hash)

    # Obtener el bloque y su hora
    block = w3.eth.get_block(tx_receipt.blockNumber)
    block_time = datetime.datetime.fromtimestamp(block.timestamp)

    return final_hash, block_time


# 👉 Verificar hash almacenado en blockchain (por tx_hash)
def verify_document(request):
    if request.method != 'POST':
        return render(request, 'index.html')

    try:
        archivo = request.FILES.get('document')
        tx_hash = request.POST.get('tx_hash')

        # Datos faltantes
        if not archivo or not tx_hash:
            if request.headers.get('x-requested-with') == 'XMLHttpRequest':
                return JsonResponse({
                    'success': False,
                    'error': 'Archivo y hash de transacción son obligatorios.'
                })
            return render(request, 'index.html', {
                'verify_error': 'Archivo y hash de transacción son obligatorios.'
            })

        # ¿Existe en nuestra BD de documentos certificados?
        documento = Documento.objects.filter(hash_transaccion=tx_hash).first()
        if not documento:
            # No está certificado en nuestra app -> salir aquí
            if request.headers.get('x-requested-with') == 'XMLHttpRequest':
                return JsonResponse({
                    'success': False,
                    'not_certified': True,
                    'error': 'El documento no se encuentra certificado. Certifícalo e intenta nuevamente.'
                })
            # flujo no-AJAX
            return render(request, 'index.html', {
                'verify_error': 'El documento no se encuentra certificado. Certifícalo e intenta nuevamente.'
            })

        # Sí existe en BD: ahora calculamos hash y comparamos con blockchain
        file_hash = generate_sha256(archivo)
        blockchain_hash = verify_hash_on_blockchain(tx_hash)

        if not blockchain_hash:
            if request.headers.get('x-requested-with') == 'XMLHttpRequest':
                return JsonResponse({
                    'success': False,
                    'error': 'No se encontró ningún hash en esa transacción.',
                    'tx_hash': tx_hash
                })
            return render(request, 'index.html', {
                'verify_error': 'No se encontró ningún hash en esa transacción.',
                'tx_hash': tx_hash
            })

        is_valid = (file_hash.lower() == blockchain_hash.lower())

        # Guardar resultado de verificación
        Verificacion.objects.create(
            documento=documento,
            resultado=is_valid,
            hash_verificado=file_hash
        )

        fecha_cert = localtime(documento.fecha_subida).strftime("%d/%m/%Y %H:%M:%S")

        # Respuesta AJAX
        if request.headers.get('x-requested-with') == 'XMLHttpRequest':
            return JsonResponse({
                'success': True,
                'verified': is_valid,
                'file_hash': file_hash,
                'blockchain_hash': blockchain_hash,
                'fecha_certificacion': fecha_cert,
                'tx_hash': tx_hash,
            })

        # Render tradicional
        return render(request, 'index.html', {
            'verify_success': True,
            'verify_result': is_valid,
            'file_hash': file_hash,
            'blockchain_hash': blockchain_hash,
            'tx_hash': tx_hash,
            'tx_link': f"https://sepolia.etherscan.io/tx/{tx_hash}",
            'documento': documento
        })

    except Exception as e:
        if request.headers.get('x-requested-with') == 'XMLHttpRequest':
            return JsonResponse({'success': False, 'error': f'Error: {str(e)}'})
        return render(request, 'index.html', {'verify_error': f'Error: {str(e)}'})
def index(request):
    return render(request, 'index.html')