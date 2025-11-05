# 📧 Configuración de Email - FindIA

## 🔑 Configuración de Gmail SMTP

Para que FindIA pueda enviar emails de notificación, necesitas configurar una **App Password** de Gmail.

### Pasos para obtener una App Password de Gmail:

1. **Habilita la verificación en dos pasos** (si no la tienes):
   - Ve a tu cuenta de Google: https://myaccount.google.com/
   - Seguridad → Verificación en 2 pasos → Activar

2. **Genera una App Password**:
   - Ve a: https://myaccount.google.com/apppasswords
   - O ve a: Seguridad → Verificación en 2 pasos → Contraseñas de aplicaciones
   - Selecciona "Aplicación": Correo
   - Selecciona "Dispositivo": Otro (personalizado)
   - Escribe "FindIA" y haz clic en "Generar"
   - **Copia la contraseña de 16 caracteres** (sin espacios)

3. **Configura las variables de entorno**:

   En tu archivo `.env.local` (desarrollo) o en Vercel (producción), agrega:

   ```bash
   # Email Configuration
   EMAIL_USER=findiaok@gmail.com
   EMAIL_PASSWORD=tu-app-password-aqui
   ```

   ⚠️ **IMPORTANTE**: 
   - Usa la **App Password** de 16 caracteres, NO tu contraseña normal de Gmail
   - La App Password es algo como: `abcd efgh ijkl mnop` (cópiala sin espacios: `abcdefghijklmnop`)

### Variables de Entorno en Vercel:

1. Ve a tu proyecto en Vercel
2. Settings → Environment Variables
3. Agrega:
   - `EMAIL_USER` = `findiaok@gmail.com`
   - `EMAIL_PASSWORD` = `tu-app-password-de-16-caracteres`

## 📨 Tipos de Emails Enviados

FindIA envía automáticamente emails en estos casos:

1. **Gasto Compartido** (`sendSharedExpenseNotification`):
   - Se envía cuando un usuario comparte un gasto con otro
   - Incluye: nombre del gasto, monto total, tu parte, parte del compañero, notas

2. **Gasto Aceptado** (`sendSharedExpenseAcceptedNotification`):
   - Se envía al dueño del gasto cuando el compañero acepta el gasto compartido
   - Incluye: nombre del gasto, monto que te debe el compañero

3. **Gasto Rechazado** (`sendSharedExpenseRejectedNotification`):
   - Se envía al dueño del gasto cuando el compañero rechaza el gasto compartido
   - Incluye: nombre del gasto rechazado

## 🧪 Probar el Envío de Emails

Una vez configurado, puedes probar enviando un gasto compartido desde el dashboard. El email se enviará automáticamente al usuario con quien compartiste el gasto.

## 🔍 Verificar Configuración

Si los emails no se envían, verifica:

1. ✅ Que `EMAIL_USER` esté configurado
2. ✅ Que `EMAIL_PASSWORD` sea una App Password válida (16 caracteres)
3. ✅ Que la verificación en 2 pasos esté activada en Gmail
4. ✅ Revisa los logs del servidor para ver errores de conexión

## 📝 Notas

- Los emails se envían de forma **asíncrona** y **no bloquean** la creación del gasto compartido
- Si falla el envío del email, el gasto compartido se crea igualmente (se registra el error en los logs)
- Los emails se envían desde `findiaok@gmail.com` con el nombre "FindIA"

