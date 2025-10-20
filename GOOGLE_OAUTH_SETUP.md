# Configuración de Google OAuth para FindIA

## ⚠️ Error Actual

El error que estás viendo es porque las credenciales de Google OAuth no están configuradas. Las variables de entorno están usando valores placeholder.

## 📋 Pasos para Configurar Google OAuth

### 1. Crear Proyecto en Google Cloud Console

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto o selecciona uno existente
3. Habilita la **Google+ API** y **Google Sheets API**

### 2. Configurar Pantalla de Consentimiento OAuth

1. Ve a **APIs & Services** > **OAuth consent screen**
2. Selecciona **External** (a menos que tengas Google Workspace)
3. Completa la información requerida:
   - **App name**: FindIA
   - **User support email**: tu email
   - **Developer contact information**: tu email
4. Agrega los scopes:
   - `openid`
   - `email`
   - `profile`
   - `https://www.googleapis.com/auth/spreadsheets`

### 3. Crear Credenciales OAuth 2.0

1. Ve a **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **OAuth 2.0 Client IDs**
3. Selecciona **Web application**
4. Configura las URLs:
   - **Authorized JavaScript origins**:
     - `http://localhost:3000`
   - **Authorized redirect URIs**:
     - `http://localhost:3000/api/auth/callback/google`

### 4. Configurar Variables de Entorno

Reemplaza el contenido de `.env.local` con:

```bash
# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=tu-secret-key-super-segura-aqui-cambiarla-en-produccion

# Google OAuth Credentials (obtener de Google Cloud Console)
GOOGLE_CLIENT_ID=tu-google-client-id-real-aqui
GOOGLE_CLIENT_SECRET=tu-google-client-secret-real-aqui

# Google Sheets API (opcional para funcionalidad completa)
GOOGLE_SHEETS_ID=tu-google-sheets-id-aqui
GOOGLE_API_KEY=tu-google-api-key-aqui
GOOGLE_SERVICE_ACCOUNT_EMAIL=tu-service-account@proyecto.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\ntu-private-key-aqui\n-----END PRIVATE KEY-----"
```

## 🔄 Después de Configurar

1. Reinicia el servidor de desarrollo:
   ```bash
   npm run dev
   ```

2. Prueba el login nuevamente

## 🛠️ Solución Temporal (Para Testing)

Si quieres probar la aplicación sin configurar Google OAuth, puedes:

1. Comentar temporalmente el GoogleProvider en la configuración
2. Usar un sistema de autenticación mock

¿Te gustaría que implemente una solución temporal o prefieres configurar Google OAuth ahora?

## 📞 Contacto

Si necesitas ayuda con la configuración, puedes:
- Revisar la documentación de [NextAuth.js](https://next-auth.js.org/providers/google)
- Seguir el tutorial de [Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)