# 📊 Configuración de Google Sheets Database

FindIA utiliza Google Sheets como base de datos para almacenar la información financiera de los usuarios. Esta guía te ayudará a configurar la integración paso a paso.

## 🚀 Configuración Rápida

### 1. Crear el Proyecto en Google Cloud

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto o selecciona uno existente
3. En el dashboard del proyecto, ve a **APIs & Services** > **Library**
4. Busca y habilita **Google Sheets API**

### 2. Obtener Credenciales

#### Opción A: API Key (Solo Lectura) 
*Más simple, ideal para pruebas*

1. Ve a **APIs & Services** > **Credentials**
2. Haz clic en **+ CREATE CREDENTIALS** > **API Key**
3. Copia la API Key generada
4. Agrega a tu `.env`:
   ```
   VITE_GOOGLE_API_KEY=tu_api_key_aqui
   ```

#### Opción B: Service Account (Recomendado)
*Acceso completo de lectura y escritura*

1. Ve a **APIs & Services** > **Credentials**
2. Haz clic en **+ CREATE CREDENTIALS** > **Service Account**
3. Completa el formulario y crea la cuenta
4. En la página de la Service Account, ve a la pestaña **Keys**
5. Haz clic en **ADD KEY** > **Create new key** > **JSON**
6. Descarga el archivo JSON
7. Del archivo JSON, extrae:
   - `client_email` → `VITE_GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `private_key` → `VITE_GOOGLE_PRIVATE_KEY`

### 3. Crear la Hoja de Cálculo

1. Ve a [Google Sheets](https://sheets.google.com)
2. Crea una nueva hoja de cálculo
3. Nómbrala "FindIA Database" o como prefieras
4. De la URL, extrae el ID:
   ```
   https://docs.google.com/spreadsheets/d/[ESTE_ES_EL_ID]/edit
   ```
5. Agrega a tu `.env`:
   ```
   VITE_GOOGLE_SHEET_ID=tu_sheet_id_aqui
   ```

### 4. Configurar Permisos (Solo para Service Account)

Si usaste Service Account:
1. Abre tu hoja de cálculo de Google Sheets
2. Haz clic en **Share** (Compartir)
3. Agrega el email de tu Service Account
4. Otorga permisos de **Editor**

## 📋 Estructura de la Hoja

### 🏗️ Inicialización Automática

FindIA incluye una herramienta de configuración que creará automáticamente la estructura necesaria en tu Google Sheet. Esta herramienta aparecerá en el Dashboard para usuarios administradores.

**Administradores configurados:**
- coderflixarg@gmail.com 👑
- d86webs@gmail.com 👑

### 📊 Pestañas que se crearán:

### `users` (Usuarios)
| A | B | C | D | E |
|---|---|---|---|---|
| id | name | email | createdAt | preferences |

### `debts` (Deudas)
| A | B | C | D | E | F | G | H | I | J |
|---|---|---|---|---|---|---|---|---|---|
| id | userId | name | amount | currentAmount | minimumPayment | interestRate | category | createdAt | updatedAt |

### `payments` (Pagos)
| A | B | C | D | E | F |
|---|---|---|---|---|---|
| id | debtId | userId | amount | paymentDate | notes |

## 🛠️ Variables de Entorno

Copia `.env.example` a `.env` y completa:

```bash
# Opción 1: Solo API Key
VITE_GOOGLE_API_KEY=tu_api_key

# Opción 2: Service Account (Recomendado)
VITE_GOOGLE_SERVICE_ACCOUNT_EMAIL=service@proyecto.iam.gserviceaccount.com
VITE_GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\ntu_clave\n-----END PRIVATE KEY-----"

# Obligatorio
VITE_GOOGLE_SHEET_ID=tu_sheet_id

# Opcional
VITE_GOOGLE_SHEETS_RANGE=A1:Z1000
```

## ✅ Verificar la Configuración

1. Ejecuta el proyecto:
   ```bash
   npm run dev
   ```

2. Abre http://localhost:5173 en tu navegador

3. **Indicadores visuales de éxito:**
   - 🟢 **No aparece banner azul** en la parte superior (solo aparece en modo demo)
   - 🟢 **Indicador verde** en esquina superior derecha: "📊 Conectado a Google Sheets"
   
4. **En la consola del navegador (F12 > Console):**
   ```
   🔧 FindIA Google Sheets Service - Inicializando...
   ✅ Google Sheets configurado correctamente
   📊 Usando Google Sheets como database
   📄 Sheet ID: 1lH_B8rkigbGjf... (parcialmente oculto)
   🔐 Credenciales válidas detectadas
   ```

5. **Para administradores**: Aparecerá un panel adicional "🏗️ Configuración Inicial de Google Sheets" para crear la estructura automáticamente.

Si ves errores, revisa:
- ✅ Las credenciales están correctas
- ✅ La API de Google Sheets está habilitada
- ✅ Los permisos de la hoja están configurados
- ✅ No hay espacios extra en las variables de entorno

## 🔧 Modo Demo vs Producción

### Modo Demo (Sin Configuración)
- ✅ Funciona inmediatamente
- ✅ Datos de ejemplo preconfigurados
- ❌ Los datos no se guardan
- ❌ Se pierden al recargar

### Modo Producción (Con Google Sheets)
- ✅ Datos persistentes
- ✅ Sincronización automática
- ✅ Backup en la nube
- ❌ Requiere configuración inicial

## 🆘 Solución de Problemas

### Error: "API Key inválida"
- Verifica que la API Key sea correcta
- Asegúrate que Google Sheets API esté habilitada

### Error: "No se puede acceder a la hoja"
- Verifica el ID de la hoja
- Para Service Account: asegúrate que tenga permisos

### Error: "CORS"
- Esto es normal en desarrollo
- En producción, configura los dominios permitidos en Google Cloud

### Los datos no se guardan
- Verifica las credenciales de Service Account
- Comprueba los permisos de escritura en la hoja

## 🎯 Próximos Pasos

Una vez configurado:
1. Los usuarios podrán registrar sus deudas
2. Los datos se sincronizarán automáticamente
3. La información persistirá entre sesiones
4. Podrás acceder a los datos desde múltiples dispositivos

¡Tu base de datos financiera ya está lista! 🚀