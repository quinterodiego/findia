# Variables de Entorno para Vercel - Copia y Pega EXACTAMENTE

## 🔑 Variables CRÍTICAS que faltan en Vercel

Ve a: https://vercel.com/dashboard → findia → Settings → Environment Variables

### Variables a Agregar (Environment: Production):

**GOOGLE_SHEETS_ID**
```
1lH_B8rkigbGjfhIN1vHt7Nwo6kMJW7mE3_cTY7DqcYQ
```

**GOOGLE_SERVICE_ACCOUNT_EMAIL**
```
findia@findia-475412.iam.gserviceaccount.com
```

**GOOGLE_PRIVATE_KEY** (COPIA TODO, incluye las comillas):
```
"-----BEGIN PRIVATE KEY-----
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

## ⚠️ CRÍTICO: Formato del GOOGLE_PRIVATE_KEY

1. **INCLUYE las comillas** al inicio y final: `"`
2. **NO agregues espacios** extra
3. **Copia TODO el bloque** desde la comilla inicial hasta la final
4. **Mantén los saltos de línea** exactamente como están

## 🔄 Después de Agregar las Variables

1. **Guarda** todas las variables en Vercel
2. **Espera 2-3 minutos** para que se propaguen
3. **Ve a**: https://findia.vercel.app/api/debug/env
4. **Verifica** que todas muestren ✅
5. **Refresca** el dashboard: https://findia.vercel.app/dashboard

## 📋 Checklist de Variables

- [ ] GOOGLE_SHEETS_ID
- [ ] GOOGLE_SERVICE_ACCOUNT_EMAIL  
- [ ] GOOGLE_PRIVATE_KEY (con comillas y formato correcto)
- [ ] NEXTAUTH_URL=https://findia.vercel.app
- [ ] NEXTAUTH_SECRET (el mismo que tienes local)
- [ ] GOOGLE_CLIENT_ID
- [ ] GOOGLE_CLIENT_SECRET