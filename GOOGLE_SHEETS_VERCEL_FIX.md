# 🚨 Error en Dashboard: Google Sheets API

## Problema Identificado
El dashboard se autentica correctamente con Google OAuth, pero falla al cargar datos desde Google Sheets API.

## ✅ Variables de Entorno Necesarias en Vercel

**Variables que DEBES agregar en Vercel → Settings → Environment Variables:**

```bash
# Google Sheets API (CRÍTICAS)
GOOGLE_SHEETS_ID=1lH_B8rkigbGjfhIN1vHt7Nwo6kMJW7mE3_cTY7DqcYQ
GOOGLE_SERVICE_ACCOUNT_EMAIL=findia@findia-475412.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC2/rohS/s7nOQP
LCuWxoCwg1z+waAGga2w6k6D9hsDUHh+tzI2/JbthlPsgNHgrDVc5fGP78/0mOdj
6ptHHAPWro+b/ZOWrizgphJHLrw+A0aEUtvCZYvYw3po5s4tYRggvBIk+LbalMzK
AvyklFU3CAZSlRDGtC3KISSLT1rjfmkz2gbOdLgpjsONknmJXz+UPUh/bZwQn2LI
NiEupl2Xk0npAXagT21fD44/P+VMRjFIo3GpScrZCte3gndm4qSuXkIVjs2d4S6I
PEFyDBUrDOn4OqR1eIC7ZolmkkVvThz2AKLa40yPB73F2oRkkdMFAgamyRsoWL42
AurgJk2XAgMBAAECggEABJxGree/VNap659GGok2HScKH5mwQZ8LHxMgLEn15JpR
QYa1u1Xs1YorW3Y5aMrd7fvAdMsVdwj9LMgbO7+UcdhkYjPm1TEz4esSjdGQc5Lb
OCKVn9W1dXN4sOOTxpKU1t+g02aixhS2qND0yDlmgORGXdacnWz/tFaBGF4aS533
lIsIWs0V+n6je5ofD7GTwTXjCLM2oFHAFopFjv3a/HHeEtZe4LzpEPJ3zyYJOyyf
xUyx1273G19lI+KCOTNrNd7gDJCkY4/H77H4rLK4FkFYQqBHdReWmA0K/VnS8wyP
FbXNkGX/eBXbkw2TePzZtdlY4aEE3VXE+VROjpCXAQKBgQDxJw6edDkkVrsSov1h
nIpDhTYEgNq/yfxguzGEnRZWZAkIISiLDVmWVR3BSas6cnCXAbS6vhwfhExfu9vq
2zNtsPSEGrR+IYfDwgVx3Ir4TqUGmkZdT4VRQ7CVPS4nLICEHTD+I04H1wlJdoJm
5gMegtqDvCfO6PH828IWzHZqlwKBgQDCQwQQwPUKrS9tfMvtV9dRd9CTT4tyA/ZH
pT08/wJ6dEryAXQ9IpZ3yaYF3hBvb+/34e2U3fplVDN4vZxZ5Fip21460t++fW8f
jorjvS+K12CmhIB5erL4HzZZFabyRkpOuJRtNOzCKRkYxYO0L2j/zVCdC3Z0ogNZ
8zxtaEqVAQKBgQCIAcEq+N2pcwj7D9XcEY+hWSYIECxPcrnWTH03D+mjO7QkU58s
HZFjSgoIE2ZxBk4dvKaTk9kEpXb1n1v+7zXoLZ8aSn11ja+mZmzvtLTkKmbEfIom
4kyMcqLK6MB4845f9J7HFl5R6aOhPSd6pUspEB/xoFLLTXH9bGvgs9wtbQKBgQCh
G5MzkdOnlxnOY8F8hW09U3DXuxCa7k5B/PhcreEQTYIaUrpkOVsw3Tujghd/VAZg
Pi8bVz1i7AIEELyqkIY32Ia9okWNZdnTAhSN60iSjSzK7PjfxrLGtJwOJbbfFwxp
XQs7xrjUDeGSebxQo0EhZNWGaQtEj1jYMLHcyrGQAQKBgApaZF80QlAXLPn/cI7Y
0UKAs0JhqmQ+B04SLaqTUIvfXzuL1/hxkllugshsZkN/+1i2Vn3ElPjZRaSF+ILP
nNcfkPhU1xPZzDUWr3mTHK+5VJ3hwHCU+bakVCZPPLGPxuoNmfgNQ9ameqUvGHhj
BzUhBqAjdGL5n5rIc3apthh+
-----END PRIVATE KEY-----"
```

## 🔧 Pasos Inmediatos

### 1. Verificar Google Sheets
- Ve a: https://docs.google.com/spreadsheets/d/1lH_B8rkigbGjfhIN1vHt7Nwo6kMJW7mE3_cTY7DqcYQ
- Verifica que esté compartida con: findia@findia-475412.iam.gserviceaccount.com
- Permisos: Editor

### 2. Agregar Variables en Vercel
Ve a: https://vercel.com/dashboard → findia → Settings → Environment Variables

**IMPORTANTE**: 
- El `GOOGLE_PRIVATE_KEY` debe incluir las comillas y saltos de línea exactos
- Copia TODO el bloque desde `"-----BEGIN` hasta `-----"`

### 3. Redeploy
Después de agregar las variables:
- Ve a Vercel → Deployments
- Haz clic en "Redeploy" del último deployment

## 🐛 Debugging

Si aún no funciona, revisar:
1. **Logs de Vercel**: Functions tab → Ver errores específicos
2. **Permisos de Google Sheets**: Service account debe tener acceso
3. **Formato de PRIVATE_KEY**: Debe conservar saltos de línea \n

## ✅ Verificación Final

Una vez configurado:
- El dashboard debería cargar sin errores
- Deberías ver las estadísticas reales
- El botón "Agregar Primera Deuda" debería funcionar