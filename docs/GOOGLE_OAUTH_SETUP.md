# 🔧 Configuración de Google OAuth para Findia

## 📋 Resumen
Esta guía te ayudará a configurar la autenticación con Google para tu aplicación Findia.

## 🚀 Pasos de Configuración

### 1. Google Cloud Console Setup

1. **Ir a Google Cloud Console**
   - Visita: https://console.cloud.google.com/
   - Inicia sesión con tu cuenta de Google

2. **Crear Nuevo Proyecto**
   - Clic en "Select a project" → "NEW PROJECT"
   - Nombre: `Findia Auth`
   - Clic en "CREATE"

3. **Habilitar APIs Necesarias**
   - Ve a "APIs & Services" → "Library"
   - Busca y habilita: "Google Identity Services API"
   - Clic en "ENABLE"

### 2. Configurar OAuth Consent Screen

1. **Ir a OAuth Consent Screen**
   - "APIs & Services" → "OAuth consent screen"
   - Selecciona "External"

2. **Llenar Información Básica**
   ```
   App name: Findia
   User support email: [tu-email@gmail.com]
   Developer contact email: [tu-email@gmail.com]
   ```

3. **Continuar con Defaults**
   - Scopes: Usar por defecto
   - Test users: Agregar tu email si deseas

### 3. Crear Credenciales OAuth

1. **Crear Client ID**
   - "APIs & Services" → "Credentials"
   - "+ CREATE CREDENTIALS" → "OAuth client ID"
   - Tipo: "Web application"

2. **Configurar URLs Autorizadas**
   ```
   Name: Findia Web Client
   
   Authorized JavaScript origins:
   - http://localhost:5173
   - http://localhost:5174
   - http://127.0.0.1:5173
   - http://127.0.0.1:5174
   
   Authorized redirect URIs:
   - http://localhost:5173
   - http://localhost:5174
   ```

3. **Obtener Credenciales**
   - Después de crear, verás tu Client ID
   - Formato: `123456789-abcdef...apps.googleusercontent.com`
   - **¡GUARDA ESTE Client ID!**

### 4. Configurar Variables de Entorno

1. **Abrir archivo `.env`** (ya creado en tu proyecto)

2. **Reemplazar el Client ID**
   ```env
   # Reemplaza 'tu_client_id_aqui' con tu Client ID real
   VITE_GOOGLE_CLIENT_ID=123456789-abcdef...apps.googleusercontent.com
   ```

3. **Ejemplo completo:**
   ```env
   # Google OAuth Configuration
   VITE_GOOGLE_CLIENT_ID=123456789-abcdefghijk.apps.googleusercontent.com
   
   # Google Sheets API (para funcionalidad futura)
   VITE_GOOGLE_SHEETS_ID=
   VITE_GOOGLE_API_KEY=
   ```

### 5. Probar la Configuración

1. **Reiniciar el servidor de desarrollo:**
   ```bash
   npm run dev
   ```

2. **Abrir la aplicación en el navegador:**
   - http://localhost:5174/ (o el puerto que muestre)

3. **Probar login con Google:**
   - Abrir modal de login
   - Clic en "Continúa con Google"
   - Debería aparecer el popup de Google

## 🔍 Troubleshooting

### Problema: "Error loading Google Identity Services"
**Solución:** Verifica que tu dominio esté en las URLs autorizadas

### Problema: "Invalid client ID"
**Solución:** 
- Verifica que el Client ID esté correcto en `.env`
- Reinicia el servidor después de cambiar `.env`

### Problema: "Popup blocked"
**Solución:** Permite popups para localhost en tu navegador

### Problema: "Origin not allowed"
**Solución:** 
- Agrega tu URL exacta a "Authorized JavaScript origins"
- Incluye tanto localhost como 127.0.0.1

## 📱 URLs Para Producción

Cuando despliegues tu app, agrega a las URLs autorizadas:
```
https://tu-dominio.com
https://www.tu-dominio.com
```

## 🔐 Seguridad

- **NO** compartas tu Client ID públicamente (aunque aparezca en el frontend)
- **NO** uses Client Secret en aplicaciones frontend
- Mantén tu proyecto de Google Cloud privado
- Revisa regularmente los usuarios autorizados

## ✅ Checklist Final

- [ ] Proyecto creado en Google Cloud Console
- [ ] Google Identity Services API habilitada
- [ ] OAuth Consent Screen configurado
- [ ] Credenciales OAuth creadas
- [ ] Client ID agregado al archivo `.env`
- [ ] Servidor reiniciado
- [ ] Login con Google probado

## 📞 Ayuda Adicional

Si tienes problemas:
1. Revisa la consola del navegador para errores
2. Verifica que el archivo `.env` esté en la raíz del proyecto
3. Asegúrate de que no hay espacios extra en el Client ID
4. Intenta con una ventana de incógnito

---

**¡Una vez completado esto, tu login con Google estará 100% funcional!** 🎉