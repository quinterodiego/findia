# 🚨 SOLUCIÓN DEFINITIVA: Private Key Corrupta

## Problema Identificado
❌ Error: `error:1E08010C:DECODER routines::unsupported`
❌ La private key tiene formato corrupto o caracteres faltantes

## 🔧 SOLUCIÓN INMEDIATA

Ve a Vercel → Settings → Environment Variables → GOOGLE_PRIVATE_KEY

**REEMPLAZA COMPLETAMENTE** con esta versión corregida:

```
"-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC2/rohS/s7nOQP\nLCuWxoCwg1z+waAGga2w6k6D9hsDUHh+tzI2/JbthlPsgNHgrDVc5fGP78/0mOdj\n6ptHHAPWro+b/ZOWrizgphJHLrw+A0aEUtvCZYvYw3po5s4tYRggvBIk+LbalMzK\nAvyklFU3CAZSlRDGtC3KISSLT1rjfmkz2gbOdLgpjsONknmJXz+UPUh/bZwQn2LI\nNiEupl2Xk0npAXagT21fD44/P+VMRjFIo3GpScrZCte3gndm4qSuXkIVjs2d4S6I\nPEFyDBUrDOn4OqR1eIC7ZolmkkVvThz2AKLa40yPB73F2oRkkdMFAgamyRsoWL42\nAurgJk2XAgMBAAECggEABJxGree/VNap659GGok2HScKH5mwQZ8LHxMgLEn15JpR\nQYa1u1Xs1YorW3Y5aMrd7fvAdMsVdwj9LMgbO7+UcdhkYjPm1TEz4esSjdGQc5Lb\nOCKVn9W1dXN4sOOTxpKU1t+g02aixhS2qND0yDlmgORGXdacnWz/tFaBGF4aS533\nlIsIWs0V+n6je5ofD7GTwTXjCLM2oFHAFopFjv3a/HHeEtZe4LzpEPJ3zyYJOyyf\nxUyx1273G19lI+KCOTNrNd7gDJCkY4/H77H4rLK4FkFYQqBHdReWmA0K/VnS8wyP\nFbXNkGX/eBXbkw2TePzZtdlY4aEE3VXE+VROjpCXAQKBgQDxJw6edDkkVrsSov1h\nnIpDhTYEgNq/yfxguzGEnRZWZAkIISiLDVmWVR3BSas6cnCXAbS6vhwfhExfu9vq\n2zNtsPSEGrR+IYfDwgVx3Ir4TqUGmkZdT4VRQ7CVPS4nLICEHTD+I04H1wlJdoJm\n5gMegtqDvCfO6PH828IWzHZqlwKBgQDCQwQQwPUKrS9tfMvtV9dRd9CTT4tyA/ZH\npT08/wJ6dEryAXQ9IpZ3yaYF3hBvb+/34e2U3fplVDN4vZxZ5Fip21460t++fW8f\njorjvS+K12CmhIB5erL4HzZZFabyRkpOuJRtNOzCKRkYxYO0L2j/zVCdC3Z0ogNZ\n8zxtaEqVAQKBgQCIAcEq+N2pcwj7D9XcEY+hWSYIECxPcrnWTH03D+mjO7QkU58s\nHZFjSgoIE2ZxBk4dvKaTk9kEpXb1n1v+7zXoLZ8aSn11ja+mZmzvtLTkKmbEfIom\n4kyMcqLK6MB4845f9J7HFl5R6aOhPSd6pUspEB/xoFLLTXH9bGvgs9wtbQKBgQCh\nG5MzkdOnlxnOY8F8hW09U3DXuxCa7k5B/PhcreEQTYIaUrpkOVsw3Tujghd/VAZg\nPi8bVz1i7AIEELyqkIY32Ia9okWNZdnTAhSN60iSjSzK7PjfxrLGtJwOJbbfFwxp\nXQs7xrjUDeGSebxQo0EhZNWGaQtEj1jYMLHcyrGQAQKBgApaZF80QlAXLPn/cI7Y\n0UKAs0JhqmQ+B04SLaqTUIvfXzuL1/hxkllugshsZkN/+1i2Vn3ElPjZRaSF+ILP\nnNcfkPhU1xPZzDUWr3mTHK+5VJ3hwHCU+bakVCZPPLGPxuoNmfgNQ9ameqUvGHhj\nBzUhBqAjdGL5n5rIc3apthh+\n-----END PRIVATE KEY-----\n"
```

## 🔄 Pasos Críticos:

1. **Borra completamente** la variable actual en Vercel
2. **Crea nueva** variable con el valor de arriba
3. **Copia EXACTAMENTE** todo desde `"-----BEGIN` hasta `-----\n"`
4. **Guarda** la variable
5. **Espera 2-3 minutos**

## ✅ Verificación:

Después del cambio:
1. Ve a: https://findia.vercel.app/api/debug/sheets
2. Debería mostrar `"success": true` 
3. El dashboard debería cargar los datos

## 🚨 SI AÚN NO FUNCIONA

Si el problema persiste, necesitaremos **generar una nueva Service Account** en Google Cloud Console, ya que la actual puede tener la private key corrupta.

---

**IMPORTANTE**: Usa exactamente el texto de arriba, no copies desde tu .env local ya que esa también puede estar corrupta.