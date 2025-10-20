# � Configuración de Google OAuth para FindIA

## 📋 **PROBLEMA RESUELTO**: Datos Simulados en Lugar de Autenticación Real

**⚠️ Problema identificado**: La aplicación estaba usando datos **simulados** (mock) en lugar de autenticación real con Google OAuth. Por eso no solicitaba permisos y mostraba datos genéricos como "Usuario Google".

**✅ Solución implementada**: Se corrigió el flujo de autenticación para usar el servicio real de Google OAuth con solicitud de permisos apropiados.

---

## ⚙️ Configuración Requerida en Google Cloud Console

Para que la autenticación funcione correctamente, necesitas configurar lo siguiente en [Google Cloud Console](https://console.cloud.google.com/):

### 1. Configurar Cliente OAuth 2.0

1. Ve a **APIs y servicios** → **Credenciales**
2. Busca tu **Cliente OAuth 2.0** existente (ID: `986863857557-am9buuaejh1gdamoa0umueerhk2pnbhj.apps.googleusercontent.com`)
3. **EDITA** las configuraciones del cliente:

#### **Orígenes de JavaScript autorizados:**
```
http://localhost:5173
http://localhost:3000
```

#### **URIs de redirección autorizados:**
```
http://localhost:5173
http://localhost:3000
```

⚠️ **IMPORTANTE**: Asegúrate de que EXACTAMENTE `http://localhost:5173` esté en ambas listas.

### 2. Configurar Pantalla de Consentimiento OAuth

1. Ve a **APIs y servicios** → **Pantalla de consentimiento OAuth**

2. **🚨 IMPORTANTE - Tipo de Aplicación**:
   - **OPCIÓN 1 (Recomendada)**: Selecciona **"Interna"** si tienes un dominio de Google Workspace
   - **OPCIÓN 2**: Si usas Gmail personal, selecciona **"Externa"** y continúa al paso 3

3. **Si elegiste "Externa" - Configurar Usuarios de Prueba**:
   - Completa la información básica:
     - **Nombre de la aplicación**: FindIA
     - **Email de soporte**: tu-email@gmail.com
     - **Dominios autorizados**: (opcional)
   - Ve a la sección **"Test users"**
   - Haz clic en **"+ ADD USERS"**
   - Agrega tus emails de prueba:
     ```
     d86webs@gmail.com
     coderflixarg@gmail.com
     ```
   - **GUARDA** los cambios

4. **⚠️ Importante**: Las aplicaciones "Externas" sin verificar solo permiten hasta 100 usuarios de prueba y muestran una advertencia de seguridad.

### 3. Scopes (Permisos) Configurados

La aplicación solicita los siguientes permisos:
- `email`: Para obtener el email del usuario
- `profile`: Para obtener nombre y foto de perfil
- `openid`: Para identificación básica
- `https://www.googleapis.com/auth/spreadsheets`: Para acceso a Google Sheets

---

## 🔧 Variables de Entorno Actuales

Verifica que tu archivo `.env` contenga:

```env
# Google OAuth Configuration
VITE_GOOGLE_CLIENT_ID=986863857557-am9buuaejh1gdamoa0umueerhk2pnbhj.apps.googleusercontent.com

# Google Sheets API
VITE_GOOGLE_SHEETS_ID=1lH_B8rkigbGjfhIN1vHt7Nwo6kMJW7mE3_cTY7DqcYQ
VITE_GOOGLE_API_KEY=
VITE_GOOGLE_SERVICE_ACCOUNT_EMAIL=findia@findia-475412.iam.gserviceaccount.com
VITE_GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n[TU_CLAVE_PRIVADA]\n-----END PRIVATE KEY-----\n"
```

---

## 🚀 Cómo Probar la Autenticación

1. **Inicia el servidor de desarrollo**:
   ```bash
   npm run dev
   ```

2. **Abre la aplicación** en `http://localhost:5173`

3. **Haz clic en "Continúa con Google"**

4. **Deberías ver**:
   - ✅ Una ventana popup de Google solicitando permisos
   - ✅ Lista de permisos solicitados (email, perfil, Google Sheets)
   - ✅ Tu información real de Google después del login
   - ✅ Mensajes de debug en la consola del navegador

---

## 🐛 Debugging

Si encuentras problemas, revisa:

### 1. **Consola del navegador** (F12):
```javascript
// Deberías ver logs como:
console.log('Datos reales del usuario de Google:', userData)
console.log('useGoogleAuth - Datos del usuario:', googleUser)
```

### 2. **Network tab**: 
Verifica que se hagan llamadas a:
- `https://accounts.google.com/gsi/client`
- `https://www.googleapis.com/oauth2/v2/userinfo`

### 3. **Errores comunes**:
- `unauthorized_client`: Verifica orígenes autorizados en Google Cloud
- `invalid_client`: Verifica que el CLIENT_ID sea correcto
- `popup_blocked`: Desbloquea popups en tu navegador
- **🚨 "Acceso bloqueado - Verificación de Google"**: 
  - La app está como "Externa" sin verificar
  - **Solución**: Configura como "Interna" o agrega usuarios de prueba
  - Ver documentación actualizada arriba

---

## 📝 Cambios Realizados en el Código

### ✅ Archivos Corregidos:

#### 1. **`src/components/auth/GoogleAuth.tsx`**:
- ❌ Eliminó datos simulados (`mockGoogleUser`)
- ✅ Ahora usa `GoogleAuthService.getInstance().signIn()`
- ✅ Logs de debug para verificar datos reales

#### 2. **`src/lib/googleAuth.ts`**:
- ✅ OAuth2 con scopes correctos
- ✅ Manejo de popups de Google
- ✅ Obtención real de información del usuario
- ✅ Manejo de errores apropiado

#### 3. **`src/components/auth/useGoogleAuth.ts`**:
- ❌ Eliminó simulación de datos
- ✅ Integración con servicio real de Google OAuth
- ✅ Formateo correcto de datos del usuario

---

## 🎯 Próximos Pasos

1. **Probar la autenticación** con tu cuenta real
2. **Verificar que aparezcan tus datos reales** en el perfil de usuario
3. **Configurar el admin panel** para tu cuenta específica
4. **Configurar la estructura de Google Sheets** usando el panel de administración

---

## 📞 Soporte

Si sigues experimentando problemas, revisa:
- Variables de entorno configuradas correctamente
- Configuración de Google Cloud Console
- Logs de debug en la consola del navegador
- URIs de redirección en Google Cloud Console

**¡La autenticación ahora debería funcionar correctamente y mostrar tus datos reales de Google!** 🎉
   
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