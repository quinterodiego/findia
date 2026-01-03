# 📧 Guía Completa: Configurar Gmail para Envío de Emails - FindIA

## 🎯 ¿Qué necesitas?

**Solo necesitas una App Password de Gmail** - NO necesitas credenciales de Google Cloud Console ni OAuth.

## 📋 Paso a Paso

### Paso 1: Activar Verificación en 2 Pasos

1. **Ve a tu cuenta de Google**: https://myaccount.google.com/
2. **Seguridad** → **Verificación en 2 pasos**
3. Si no está activada, **actívala** (es obligatorio para App Passwords)
   - Google te pedirá confirmar con tu teléfono
   - Sigue las instrucciones en pantalla

### Paso 2: Generar App Password

1. **Ve a App Passwords**: https://myaccount.google.com/apppasswords
   
   O navega manualmente:
   - **Seguridad** → **Verificación en 2 pasos** → **Contraseñas de aplicaciones**

2. **Genera una nueva App Password**:
   - En "Seleccionar app": Elige **"Correo"**
   - En "Seleccionar dispositivo": Elige **"Otro (nombre personalizado)"**
   - Escribe: **"FindIA"** (o el nombre que prefieras)
   - Haz clic en **"Generar"**

3. **Copia la contraseña**:
   - Google te mostrará una contraseña de **16 caracteres**
   - Se ve algo como: `abcd efgh ijkl mnop`
   - **IMPORTANTE**: Cópiala SIN espacios: `abcdefghijklmnop`
   - ⚠️ Solo se muestra UNA VEZ, guárdala bien

### Paso 3: Configurar Variables de Entorno

#### En Desarrollo (Local):

1. **Crea o edita** el archivo `.env.local` en la raíz del proyecto:

```bash
# Email Configuration
EMAIL_USER=findiaok@gmail.com
EMAIL_PASSWORD=abcdefghijklmnop
```

**Reemplaza** `abcdefghijklmnop` con tu App Password real (16 caracteres sin espacios).

#### En Producción (Vercel):

1. **Ve a tu proyecto en Vercel**: https://vercel.com/dashboard
2. **Settings** → **Environment Variables**
3. **Agrega estas variables**:

   | Name | Value | Environment |
   |------|-------|-------------|
   | `EMAIL_USER` | `findiaok@gmail.com` | Production, Preview, Development |
   | `EMAIL_PASSWORD` | `tu-app-password-de-16-caracteres` | Production, Preview, Development |

   ⚠️ **IMPORTANTE**: 
   - El `EMAIL_PASSWORD` debe ser la App Password de 16 caracteres (sin espacios)
   - NO uses tu contraseña normal de Gmail
   - Selecciona todos los ambientes (Production, Preview, Development)

4. **Guarda** y haz un nuevo deploy

### Paso 4: Verificar Configuración

1. **Reinicia tu servidor de desarrollo** (si estás en local):
   ```bash
   npm run dev
   ```

2. **Prueba compartiendo un gasto** desde el dashboard

3. **Revisa los logs** del servidor:
   - Deberías ver: `✅ Servidor de email listo para enviar mensajes`
   - Si ves errores, revisa que las variables estén correctas

## 🔍 Solución de Problemas

### Error: "Invalid login"

**Causa**: Usaste tu contraseña normal de Gmail en lugar de App Password

**Solución**: 
- Asegúrate de usar la App Password de 16 caracteres
- Verifica que no tenga espacios

### Error: "Less secure app access"

**Causa**: Google bloqueó el acceso (ya no se usa "Less secure apps")

**Solución**: 
- **NO uses** "Permitir aplicaciones menos seguras"
- Usa **App Password** (es la forma correcta y más segura)

### Error: "Username and Password not accepted"

**Causa**: La App Password es incorrecta o expiró

**Solución**:
- Genera una nueva App Password
- Asegúrate de copiarla correctamente (sin espacios)
- Verifica que la verificación en 2 pasos esté activa

### No recibo emails

**Verifica**:
1. ✅ Revisa la carpeta de **Spam**
2. ✅ Verifica que `EMAIL_USER` y `EMAIL_PASSWORD` estén configurados
3. ✅ Revisa los logs del servidor para ver errores
4. ✅ Verifica que el email del destinatario sea correcto

## 📝 Notas Importantes

- ✅ **App Password es segura**: No expone tu contraseña principal
- ✅ **Una App Password por aplicación**: Puedes tener múltiples App Passwords
- ✅ **Se puede revocar**: Si sospechas que está comprometida, revócala desde Google
- ✅ **No expira automáticamente**: A menos que revoques la verificación en 2 pasos
- ⚠️ **NO compartas** tu App Password públicamente
- ⚠️ **NO la subas** a Git (usa `.env.local` que está en `.gitignore`)

## 🎉 ¡Listo!

Una vez configurado, los emails se enviarán automáticamente cuando:
- Un usuario comparta un gasto
- Un usuario acepte un gasto compartido
- Un usuario rechace un gasto compartido

## 📧 Email de Envío

Todos los emails se enviarán desde:
- **Email**: `findiaok@gmail.com`
- **Nombre**: `FindIA`

Los destinatarios verán el email como si viniera de `FindIA <findiaok@gmail.com>`.

