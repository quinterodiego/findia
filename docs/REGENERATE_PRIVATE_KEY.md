# 🔑 REGENERAR PRIVATE KEY - Service Account Existente

## Situación Confirmada
✅ Service Account `findia@findia-475412.iam.gserviceaccount.com` existe y es correcta
✅ Funcionaba antes en producción
❌ Private key se corrompió en Vercel

## 🚀 SOLUCIÓN: Regenerar Private Key

### Paso 1: Ir a Google Cloud Console
1. **Ve a**: [Google Cloud Console](https://console.cloud.google.com/)
2. **Proyecto**: findia-475412
3. **IAM & Admin** → **Service Accounts**
4. **Busca**: `findia@findia-475412.iam.gserviceaccount.com`

### Paso 2: Generar Nueva Key
1. **Haz clic** en la service account (no en editar)
2. **Pestaña**: **KEYS**
3. **ADD KEY** → **Create new key**
4. **Key type**: **JSON** ✅
5. **CREATE**

Se descargará un archivo JSON nuevo.

### Paso 3: Extraer Datos del JSON
Del archivo descargado, necesitas solo:

```json
{
  "private_key": "-----BEGIN PRIVATE KEY-----\nNUEVA_CLAVE_AQUÍ\n-----END PRIVATE KEY-----\n",
  "client_email": "findia@findia-475412.iam.gserviceaccount.com"
}
```

### Paso 4: Actualizar SOLO GOOGLE_PRIVATE_KEY en Vercel

**NO cambies las otras variables**. Solo actualiza:

**GOOGLE_PRIVATE_KEY** (copia exactamente del JSON):
```
"-----BEGIN PRIVATE KEY-----\nNUEVA_CLAVE_AQUÍ\n-----END PRIVATE KEY-----\n"
```

### Paso 5: Verificar

1. **Espera 2-3 minutos**
2. **Ve a**: https://findia.vercel.app/api/debug/sheets
3. **Debería mostrar**: `"success": true`

## ✅ Ventajas de Esta Solución

- ✅ **Misma Service Account** (no cambias permisos)
- ✅ **Mismos permisos** en Google Sheets
- ✅ **No cambias** email ni configuración
- ✅ **Solo regeneras** la private key corrupta

## 🎯 Por Qué Esto Funciona

- La Service Account es correcta ✅
- Los permisos están bien ✅  
- Solo la private key se corrompió ❌
- Nueva private key = problema resuelto ✅

---

**Esta es la solución más rápida y eficiente para tu caso específico.**