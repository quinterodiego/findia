# Variables de Entorno para Vercel - findia.vercel.app

## Configuración Exacta para tu Deployment

Ve a: https://vercel.com/dashboard → findia → Settings → Environment Variables

Agrega estas variables (todas en Production environment):

```bash
NEXTAUTH_URL=https://findia.vercel.app

# Genera con: openssl rand -base64 32
NEXTAUTH_SECRET=tu-secret-aqui

# Desde Google Cloud Console
GOOGLE_CLIENT_ID=tu-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=tu-client-secret

# Para Google Sheets API
GOOGLE_SHEETS_ID=tu-google-sheets-id
GOOGLE_SERVICE_ACCOUNT_EMAIL=tu-service-account@proyecto.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\ntu-private-key\n-----END PRIVATE KEY-----"
```

## URLs Exactas para Google Cloud Console

### Authorized JavaScript origins:
```
https://findia.vercel.app
```

### Authorized redirect URIs:
```
https://findia.vercel.app/api/auth/callback/google
```

## Verificación

Una vez configurado, prueba en:
- https://findia.vercel.app/api/auth/signin/google

## Notas Importantes

- NO agregues "/" al final de las URLs
- Usa exactamente "https://findia.vercel.app"
- Los cambios pueden tardar 5-10 minutos en propagarse
- Redeploy en Vercel después de agregar las variables