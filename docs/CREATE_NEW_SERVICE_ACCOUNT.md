# 🔄 CREAR NUEVA SERVICE ACCOUNT - SOLUCIÓN DEFINITIVA

## Problema Persistente
❌ La private key actual está corrupta en Google Cloud
❌ Error: `DECODER routines::unsupported` persiste
✅ Necesitamos generar nuevas credenciales

## 🚀 SOLUCIÓN: Nueva Service Account

### Paso 1: Crear Nueva Service Account

1. **Ve a Google Cloud Console**: https://console.cloud.google.com/
2. **Proyecto**: Busca "findia-475412" o crea uno nuevo
3. **IAM & Admin** → **Service Accounts**
4. **+ CREATE SERVICE ACCOUNT**

### Paso 2: Configurar Service Account

**Datos básicos:**
- **Service account name**: `findia-sheets-v2`
- **Service account ID**: `findia-sheets-v2` (automático)
- **Description**: `Service Account para FindIA Google Sheets API v2`

**Permisos:**
- **Grant this service account access to project**: No necesario para Sheets
- **Grant users access to this service account**: Omitir

### Paso 3: Generar Nueva Private Key

1. **Encuentra tu nueva service account** en la lista
2. **Haz clic en los 3 puntos** → **Manage keys**
3. **ADD KEY** → **Create new key**
4. **Tipo**: **JSON** ✅
5. **CREATE** → Se descarga automáticamente

### Paso 4: Extraer Datos del JSON

Del archivo JSON descargado, necesitas:

```json
{
  "type": "service_account",
  "project_id": "findia-xxxxx",
  "private_key_id": "xxxx",
  "private_key": "-----BEGIN PRIVATE KEY-----\nXXXX\n-----END PRIVATE KEY-----\n",
  "client_email": "findia-sheets-v2@findia-xxxxx.iam.gserviceaccount.com",
  "client_id": "xxxx",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token"
}
```

### Paso 5: Actualizar Variables en Vercel

**GOOGLE_SERVICE_ACCOUNT_EMAIL:**
```
findia-sheets-v2@tu-project-id.iam.gserviceaccount.com
```

**GOOGLE_PRIVATE_KEY:** (copia EXACTAMENTE del JSON)
```
"-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgk...(tu nueva clave)...-----END PRIVATE KEY-----\n"
```

### Paso 6: Compartir Google Sheet

1. **Ve a**: https://docs.google.com/spreadsheets/d/1lH_B8rkigbGjfhIN1vHt7Nwo6kMJW7mE3_cTY7DqcYQ
2. **Compartir** → Agregar: `findia-sheets-v2@tu-project-id.iam.gserviceaccount.com`
3. **Permisos**: **Editor** ✅

### Paso 7: Habilitar APIs

En Google Cloud Console:
1. **APIs & Services** → **Library**
2. Buscar y **ENABLE**:
   - ✅ **Google Sheets API**
   - ✅ **Google Drive API** (recomendado)

## ✅ Verificación Final

1. **Espera 5 minutos** después de los cambios
2. **Ve a**: https://findia.vercel.app/api/debug/sheets
3. **Debería mostrar**: `"success": true`
4. **Dashboard debería funcionar**

---

## 🎯 Por Qué Esta Solución Funciona

- **Nueva clave privada** sin corrupción
- **Credenciales frescas** de Google
- **Formato JSON garantizado** sin errores de encoding
- **APIs habilitadas** correctamente

Esta es la solución definitiva. Una vez que tengas las nuevas credenciales, el problema se resolverá completamente.