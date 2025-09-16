from django.db import models


# ======================
# MODELO DOCUMENTO
# =======================
class Documento(models.Model):
    # Nombre original del archivo (ej. "certificado.pdf")
    nombre_del_archivo = models.CharField(max_length=255)

    # Hash SHA256 del archivo (para verificar integridad)
    hash_archivo = models.CharField(max_length=100)

    # Fecha de subida automática
    fecha_subida = models.DateTimeField(auto_now_add=True)

    # Dirección de la wallet asociada
    direccion_wallet = models.CharField(max_length=100)

    # Hash de la transacción en la blockchain
    hash_transaccion = models.CharField(max_length=100)

    def __str__(self):
        return self.nombre


# =======================
# MODELO VERIFICACIÓN
# =======================
class Verificacion(models.Model):
    # Relación con el modelo Documento. Si se borra el documento, se borran sus verificaciones.
    documento = models.ForeignKey(Documento, on_delete=models.CASCADE, related_name='verificaciones')

    # Fecha y hora en que se hizo la verificación (se genera automáticamente)
    fecha_verificacion = models.DateTimeField(auto_now_add=True)

    # Resultado de la verificación: True si es válido, False si no coincide
    resultado = models.BooleanField(default=False)

    # Hash calculado del archivo durante la verificación
    hash_verificado = models.CharField(max_length=100)

    def __str__(self):
        """
        Devuelve una representación en string de la verificación, incluyendo
        el nombre del documento y el resultado (True o False).
        """
        return f'Verificación de {self.documento.nombre} - {self.resultado}'
