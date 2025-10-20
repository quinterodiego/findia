# FindIA - Next.js Migration

## Descripción

FindIA es una aplicación de gestión inteligente de deudas que ayuda a los usuarios a rastrear y gestionar sus deudas personales de manera eficiente. Esta versión migrada a Next.js incluye autenticación completa con Google OAuth y integración con Google Sheets como base de datos.

## 🚀 Características Principales

- **Autenticación completa con Google OAuth** usando NextAuth.js
- **Gestión de deudas** con seguimiento de progreso en tiempo real
- **Integración con Google Sheets** como base de datos
- **Dashboard interactivo** con estadísticas y visualizaciones
- **Diseño responsive** con Tailwind CSS
- **Estado global** manejado con Zustand
- **TypeScript** para mayor seguridad de tipos

## 📋 Prerequisitos

- Node.js 18+ 
- npm o yarn
- Cuenta de Google para OAuth
- Google Sheets API habilitada
- Cuenta de servicio de Google Cloud

## ⚙️ Configuración

### 1. Variables de Entorno

Crea un archivo `.env.local` en la raíz del proyecto con las siguientes variables:

```env
# NextAuth.js
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=tu-secret-super-seguro-aqui

# Google OAuth
GOOGLE_CLIENT_ID=tu-google-client-id
GOOGLE_CLIENT_SECRET=tu-google-client-secret

# Google Sheets API
GOOGLE_SERVICE_ACCOUNT_EMAIL=tu-service-account@proyecto.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nTU_PRIVATE_KEY_AQUI\n-----END PRIVATE KEY-----"
GOOGLE_SHEETS_ID=tu-google-sheets-id
```

### 2. Configuración de Google Cloud

1. **Crear proyecto en Google Cloud Console**
2. **Habilitar APIs necesarias:**
   - Google Sheets API
   - Google Drive API (opcional para permisos de archivos)

3. **Configurar OAuth 2.0:**
   - Crear credenciales OAuth 2.0
   - Agregar `http://localhost:3000/api/auth/callback/google` como URI de redirección

4. **Crear cuenta de servicio:**
   - Generar clave JSON para la cuenta de servicio
   - Compartir la hoja de Google Sheets con el email de la cuenta de servicio

### 3. Configuración de Google Sheets

Crea una hoja de Google Sheets con las siguientes pestañas:
- `Users` - Para almacenar información de usuarios
- `Debts` - Para almacenar las deudas
- `Payments` - Para almacenar los pagos realizados

## 🛠️ Instalación

```bash
# Clonar el repositorio
git clone <url-del-repo>
cd findia-nextjs

# Instalar dependencias
npm install

# Ejecutar en modo desarrollo
npm run dev
```

## 📱 Uso

1. **Accede a la aplicación** en `http://localhost:3000`
2. **Inicia sesión** con tu cuenta de Google
3. **Agrega tus deudas** con la información correspondiente
4. **Rastrea tu progreso** en el dashboard
5. **Actualiza pagos** para mantener tu información al día

## 🏗️ Estructura del Proyecto

```
src/
├── app/                    # App Router de Next.js
│   ├── api/               # API Routes
│   │   ├── auth/          # NextAuth.js
│   │   └── debts/         # API de deudas
│   ├── dashboard/         # Página del dashboard
│   ├── debt/             # Páginas relacionadas con deudas
│   └── page.tsx          # Página principal
├── components/           # Componentes reutilizables
│   ├── ui/              # Componentes de UI base
│   └── providers.tsx    # Providers de contexto
├── lib/                 # Utilidades y servicios
│   └── google-sheets.ts # Servicio de Google Sheets
├── store/              # Estado global con Zustand
├── types/              # Definiciones de TypeScript
└── styles/             # Estilos globales
```

## 🔧 Tecnologías Utilizadas

- **Next.js 15** - Framework de React
- **NextAuth.js** - Autenticación
- **TypeScript** - Tipado estático
- **Tailwind CSS** - Estilos
- **Zustand** - Gestión de estado
- **Google Sheets API** - Base de datos
- **Lucide React** - Iconos
- **Framer Motion** - Animaciones (instalado, listo para usar)

## 🚢 Despliegue

### Vercel (Recomendado)

```bash
# Instalar Vercel CLI
npm i -g vercel

# Desplegar
vercel
```

Asegúrate de configurar las variables de entorno en el panel de Vercel.

### Otras Plataformas

El proyecto puede desplegarse en cualquier plataforma que soporte Next.js como:
- Netlify
- Railway
- Heroku
- AWS
- Google Cloud Run

## 🔐 Seguridad

- Las credenciales están protegidas con variables de entorno
- NextAuth.js maneja la autenticación de forma segura
- Las API routes están protegidas con validación de sesión
- Los datos se almacenan en Google Sheets con permisos controlados

## 🤝 Contribución

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para detalles.

## 🆘 Soporte

Si tienes algún problema o pregunta, por favor abre un issue en el repositorio.

---

**Desarrollado con ❤️ usando Next.js y TypeScript**
