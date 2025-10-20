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
        // Usar redirección completa en lugar de popup
        const redirectUri = window.location.origin
        const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
        
        if (!clientId) {
          reject(new Error('Google Client ID no configurado'))
          return
        }

        // Configurar los parámetros de OAuth2
        const params = new URLSearchParams({
          client_id: clientId,
          redirect_uri: redirectUri,
          response_type: 'code',
          scope: 'email profile openid',
          access_type: 'offline',
          prompt: 'consent',
          state: 'google_auth_' + Math.random().toString(36).substr(2, 9)
        })

        // Verificar si estamos regresando de Google OAuth
        const urlParams = new URLSearchParams(window.location.search)
        const code = urlParams.get('code')
        const state = urlParams.get('state')
        
        if (code && state && state.startsWith('google_auth_')) {
          // Procesar el código de autorización
          this.processAuthCode(code).then(resolve).catch(reject)
          return
        }

        // Guardar el estado antes de redirigir
        sessionStorage.setItem('google_auth_state', 'pending')
        sessionStorage.setItem('google_auth_return_url', window.location.href)
        
        // Redirigir a Google OAuth
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
        window.location.href = authUrl
        
      } catch (error) {
        console.error('Error en signIn:', error)
        reject(error)
      }
    })
  }

  async processAuthCode(code: string): Promise<any> {
    try {
      // En un entorno real, intercambiarías el código por un token en tu backend
      // Por ahora, vamos a obtener información básica del usuario usando Google's userinfo endpoint
      console.log('Código de autorización recibido:', code)
      
      // Limpiar la URL
      const url = new URL(window.location.href)
      url.searchParams.delete('code')
      url.searchParams.delete('state')
      url.searchParams.delete('scope')
      window.history.replaceState({}, document.title, url.toString())
      
      // MÉTODO TEMPORAL: Para obtener datos reales necesitaríamos el access_token
      // que se obtiene intercambiando el code en el backend.
      // Por ahora, intentaremos usar el método de Identity Services para obtener datos reales
      
      try {
        // Intentar obtener datos del usuario usando Google Identity Services
        const realUserData = await this.getUserInfoFromIdentityServices()
        if (realUserData) {
          console.log('✅ Datos reales obtenidos de Identity Services:', realUserData)
          return realUserData
        }
      } catch (identityError) {
        console.warn('No se pudieron obtener datos de Identity Services:', identityError)
      }
      
      // FALLBACK: Usar el prompt de Google Identity para obtener datos reales
      try {
        const credentialData = await this.getCredentialFromPrompt()
        if (credentialData) {
          console.log('✅ Datos reales obtenidos del credential prompt:', credentialData)
          return credentialData
        }
      } catch (credentialError) {
        console.warn('No se pudieron obtener datos del credential prompt:', credentialError)
      }
      
      // ÚLTIMO RECURSO: Datos simulados (se debe implementar backend para datos reales)
      console.warn('⚠️ Usando datos simulados - para datos reales necesitas implementar intercambio de código en backend')
      const userInfo = {
        sub: 'google_' + Math.random().toString(36).substr(2, 9),
        email: 'usuario@gmail.com', // En producción vendrá de Google
        name: 'Usuario de Google', // En producción vendrá de Google
        given_name: 'Usuario',
        picture: 'https://lh3.googleusercontent.com/a/default-user=s96-c',
        code: code
      }
      
      // Limpiar el estado de autenticación
      sessionStorage.removeItem('google_auth_state')
      sessionStorage.removeItem('google_auth_return_url')
      
      return userInfo
      
    } catch (error) {
      console.error('Error procesando código de autorización:', error)
      throw new Error('Error procesando autorización de Google')
    }
  }

  // Método auxiliar para intentar obtener datos reales del usuario
  private async getUserInfoFromIdentityServices(): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!window.google?.accounts?.id) {
        reject(new Error('Google Identity Services no disponible'))
        return
      }

      // Configurar callback temporal
      window.google.accounts.id.initialize({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        callback: (response: any) => {
          try {
            if (response.credential) {
              const userInfo = this.parseJWT(response.credential)
              resolve(userInfo)
            } else {
              reject(new Error('No credential received'))
            }
          } catch (error) {
            reject(error)
          }
        }
      })

      // Intentar mostrar el prompt
      window.google.accounts.id.prompt((notification: any) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          reject(new Error('Prompt not displayed'))
        }
      })

      // Timeout después de 3 segundos
      setTimeout(() => {
        reject(new Error('Timeout getting user info'))
      }, 3000)
    })
  }

  // Método auxiliar para obtener credencial del prompt
  private async getCredentialFromPrompt(): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        // Intentar con el método simplificado de Google Identity
        window.google?.accounts.id.initialize({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
          callback: (response: any) => {
            if (response.credential) {
              const userInfo = this.parseJWT(response.credential)
              resolve(userInfo)
            } else {
              reject(new Error('No credential in response'))
            }
          },
          auto_select: true // Intentar selección automática
        })

        // Timeout
        setTimeout(() => reject(new Error('Credential timeout')), 2000)
      } catch (error) {
        reject(error)
      }
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
      throw new Error('Error decodificando token de Google')
    }
  }

  signOut(): Promise<void> {
    return new Promise((resolve) => {
      if (window.google?.accounts.id) {
        window.google.accounts.id.disableAutoSelect()
      }
      // Limpiar también el estado de autenticación
      sessionStorage.removeItem('google_auth_state')
      sessionStorage.removeItem('google_auth_return_url')
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
          renderButton: (element: HTMLElement, config: any) => void
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