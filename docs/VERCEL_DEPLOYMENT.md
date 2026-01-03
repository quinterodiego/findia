# 🚀 Guía de Despliegue en Vercel - FindIA

## 🔧 Solución al Error 404: NOT_FOUND

El error 404 en Vercel se debe principalmente a la falta de configuración de variables de entorno. Aquí tienes la solución completa:

### 1. ✅ Variables de Entorno Requeridas

En el dashboard de Vercel, ve a **Settings > Environment Variables** y agrega:

```bash
# NextAuth Configuration
NEXTAUTH_URL=https://tu-app.vercel.app
NEXTAUTH_SECRET=tu-secret-key-aqui

# Google OAuth Configuration  
GOOGLE_CLIENT_ID=tu-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=tu-google-client-secret

# Google Sheets API Configuration
GOOGLE_SHEETS_ID=tu-google-sheets-id
GOOGLE_SERVICE_ACCOUNT_EMAIL=tu-service-account@tu-proyecto.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\ntu-private-key-aqui\n-----END PRIVATE KEY-----"
```

### 2. 🔑 Configuración de Google OAuth

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Selecciona tu proyecto o crea uno nuevo
3. Habilita las APIs necesarias:
   - Google Sheets API
   - Google Drive API (opcional pero recomendado)
4. Ve a **Credentials > OAuth 2.0 Client IDs**
5. Agrega tu dominio de Vercel a **Authorized JavaScript origins**:
   ```
   https://tu-app.vercel.app
   ```
6. Agrega la URL de callback a **Authorized redirect URIs**:
   ```
   https://tu-app.vercel.app/api/auth/callback/google
   ```

### 3. 📋 Configuración de Google Sheets API

1. En Google Cloud Console, ve a **Credentials**
2. Crea una **Service Account**
3. Descarga el JSON de credenciales
4. Extrae estos valores para las variables de entorno:
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL`: client_email del JSON
   - `GOOGLE_PRIVATE_KEY`: private_key del JSON (incluye los \\n)
5. Crea una Google Sheet y compártela con el email de la service account
6. Copia el ID de la sheet (de la URL) para `GOOGLE_SHEETS_ID`

### 4. 🔐 Generar NEXTAUTH_SECRET

```bash
# En tu terminal local:
openssl rand -base64 32
```

O usa este comando en PowerShell:
```powershell
[System.Web.Security.Membership]::GeneratePassword(32, 0)
```

### 5. 🚀 Pasos de Despliegue

1. **Configurar variables de entorno** en Vercel dashboard
2. **Hacer push** de los cambios recientes:
   ```bash
   git add .
   git commit -m "Add Vercel deployment configuration"
   git push origin main
   ```
3. **Redeploy** en Vercel (se hace automáticamente con el push)
4. **Verificar** que la app funcione en la URL de producción

### 6. 🐛 Debugging Adicional

Si aún tienes problemas:

1. **Verifica los logs de Vercel**:
   - Ve a tu proyecto en Vercel
   - Pestaña **Functions** > Ver logs de las funciones API

2. **Revisa las variables de entorno**:
   - Asegúrate que no haya espacios extra
   - Verifica que `GOOGLE_PRIVATE_KEY` tenga los saltos de línea correctos

3. **Prueba localmente**:
   ```bash
   # Crea un archivo .env.local con las mismas variables
   npm run build
   npm start
   ```

### 7. 📝 Checklist de Verificación

- [ ] Variables de entorno configuradas en Vercel
- [ ] Google OAuth configurado con URL de producción
- [ ] Google Sheets compartida con service account
- [ ] `NEXTAUTH_URL` apunta a tu dominio de Vercel
- [ ] Build exitoso sin errores
- [ ] Service account tiene permisos en Google Sheets

### 8. 🔄 URLs Importantes

- **Producción**: `https://tu-app.vercel.app`
- **Dashboard Vercel**: `https://vercel.com/dashboard`
- **Google Cloud Console**: `https://console.cloud.google.com`
- **NextAuth Callback**: `https://tu-app.vercel.app/api/auth/callback/google`

---

### 💡 Notas Importantes

- Reemplaza `tu-app` con el nombre real de tu app en Vercel
- Todas las variables deben estar en **Production** environment
- Después de cambiar variables, haz un redeploy manual si es necesario
- El error 404 debería desaparecer una vez configuradas las variables

¿Necesitas ayuda con algún paso específico? ¡Déjame saber!