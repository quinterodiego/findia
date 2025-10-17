// Servicio de autenticación con Google OAuth
export class GoogleAuthService {
  private static instance: GoogleAuthService
  private isInitialized = false

  private constructor() {}

  static getInstance(): GoogleAuthService {
    if (!GoogleAuthService.instance) {
      GoogleAuthService.instance = new GoogleAuthService()
    }
    return GoogleAuthService.instance
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      // Cargar la librería de Google Identity Services
      await this.loadGoogleIdentityScript()
      
      // Inicializar con el Client ID
      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
      if (!clientId) {
        throw new Error('Google Client ID no encontrado en variables de entorno')
      }

      // Configurar Google Identity Services
      window.google?.accounts.id.initialize({
        client_id: clientId,
        callback: (response: any) => {
          // Este callback se maneja en el componente
          console.log('Google response:', response)
        },
        cancel_on_tap_outside: false,
      })

      this.isInitialized = true
    } catch (error) {
      console.error('Error inicializando Google Auth:', error)
      throw error
    }
  }

  private loadGoogleIdentityScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (window.google?.accounts) {
        resolve()
        return
      }

      const script = document.createElement('script')
      script.src = 'https://accounts.google.com/gsi/client'
      script.async = true
      script.defer = true
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('Error cargando Google Identity Services'))
      document.head.appendChild(script)
    })
  }

  async signIn(): Promise<any> {
    await this.initialize()
    
    return new Promise((resolve, reject) => {
      try {
        window.google?.accounts.id.prompt((notification: any) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            // Si no se muestra el prompt, usar el método alternativo
            this.signInWithPopup().then(resolve).catch(reject)
          }
        })

        // También configurar el callback global
        window.google?.accounts.id.initialize({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
          callback: (response: any) => {
            const credential = response.credential
            if (credential) {
              // Decodificar el JWT para obtener la información del usuario
              const userInfo = this.parseJWT(credential)
              resolve({
                credential,
                ...userInfo
              })
            } else {
              reject(new Error('No se recibió credencial de Google'))
            }
          }
        })
      } catch (error) {
        reject(error)
      }
    })
  }

  private async signInWithPopup(): Promise<any> {
    return new Promise((resolve, reject) => {
      window.google?.accounts.oauth2.initCodeClient({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        scope: 'email profile openid',
        ux_mode: 'popup',
        callback: (response: any) => {
          if (response.code) {
            // Aquí deberías intercambiar el code por un token en tu backend
            // Por ahora, simulamos la respuesta del usuario
            resolve({
              code: response.code,
              // Datos simulados - en producción vendrían del backend
              id: 'google_' + Math.random().toString(36).substr(2, 9),
              name: 'Usuario de Google',
              email: 'usuario@gmail.com',
              picture: 'https://via.placeholder.com/150'
            })
          } else {
            reject(new Error('Error en autenticación con Google'))
          }
        },
        error_callback: (error: any) => {
          reject(new Error(`Error de Google OAuth: ${error.type}`))
        }
      }).requestCode()
    })
  }

  private parseJWT(token: string): any {
    try {
      const base64Url = token.split('.')[1]
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      )
      return JSON.parse(jsonPayload)
    } catch (error) {
      console.error('Error parsing JWT:', error)
      return {}
    }
  }

  signOut(): Promise<void> {
    return new Promise((resolve) => {
      if (window.google?.accounts.id) {
        window.google.accounts.id.disableAutoSelect()
      }
      resolve()
    })
  }
}

// Declaraciones globales para TypeScript
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void
          prompt: (callback?: (notification: any) => void) => void
          disableAutoSelect: () => void
        }
        oauth2: {
          initCodeClient: (config: any) => {
            requestCode: () => void
          }
        }
      }
    }
  }
}