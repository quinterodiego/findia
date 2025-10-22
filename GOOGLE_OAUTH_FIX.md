# 🔑 Configuración Google OAuth para Vercel - FindIA

## Error: redirect_uri_mismatch - Solución

### 📍 Paso 1: Obtener URL de Vercel
Tu URL de Vercel debería ser: `https://findia-[hash].vercel.app`

### 📍 Paso 2: Configurar Google Cloud Console

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Selecciona tu proyecto
3. Ve a **APIs y Servicios** > **Credenciales**
4. Encuentra tu **ID de cliente OAuth 2.0**
5. Haz clic en el ícono de editar (lápiz)

### 📍 Paso 3: Agregar URLs Autorizadas

En **Orígenes de JavaScript autorizados**, agrega:
```
https://tu-app.vercel.app
```

En **URIs de redirección autorizados**, agrega:
```
https://tu-app.vercel.app/api/auth/callback/google
```

### 📍 Paso 4: Variables de Entorno en Vercel

En tu dashboard de Vercel > Settings > Environment Variables:

```bash
NEXTAUTH_URL=https://tu-app.vercel.app
GOOGLE_CLIENT_ID=tu-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=tu-client-secret
NEXTAUTH_SECRET=tu-secret-generado
```

### 📍 Paso 5: Verificar y Redeploy

1. Guarda los cambios en Google Cloud Console
2. Espera 5-10 minutos para que se propaguen
3. Haz un redeploy en Vercel si es necesario

### 🐛 Troubleshooting

- **Los cambios pueden tardar hasta 10 minutos** en propagarse
- Verifica que la URL sea exactamente la misma (sin / al final)
- Asegúrate que `NEXTAUTH_URL` en Vercel coincida con la URL real

### ✅ Verificación Final

Una vez configurado:
1. Ve a `https://tu-app.vercel.app/api/auth/signin/google`
2. Deberías poder hacer login sin errores
3. Serás redirigido al dashboard después del login

---

**Nota**: Reemplaza `tu-app.vercel.app` con tu URL real de Vercel.