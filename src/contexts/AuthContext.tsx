import React, { createContext, useContext, useState, useEffect } from 'react'
import { User, AuthContextType, GoogleUser } from '@/types'
import { generateId, ValidationUtils, StorageUtils } from '@/lib/utils'

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: React.ReactNode
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Cargar usuario desde localStorage al inicializar y verificar OAuth return
  useEffect(() => {
    const loadUser = async () => {
      try {
        // Verificar si regresamos de Google OAuth
        await checkOAuthReturn()
        
        // Cargar usuario almacenado
        const storedUser = StorageUtils.loadFromLocalStorage<User>('findia_user')
        const sessionToken = StorageUtils.loadFromLocalStorage<string>('findia_session')
        
        if (storedUser && sessionToken) {
          setUser(storedUser)
        }
      } catch (error) {
        console.error('Error loading user session:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadUser()
  }, [])

  // Función para verificar si regresamos de Google OAuth
  const checkOAuthReturn = async () => {
    const urlParams = new URLSearchParams(window.location.search)
    const code = urlParams.get('code')
    const state = urlParams.get('state')
    
    if (code && state && state.startsWith('google_auth_')) {
      console.log('Detectado retorno de Google OAuth, procesando código:', code)
      
      try {
        // Importar dinámicamente el servicio de Google Auth
        const { GoogleAuthService } = await import('../lib/googleAuth')
        const authService = GoogleAuthService.getInstance()
        
        // Procesar DIRECTAMENTE el código sin llamar a signIn() de nuevo
        const googleUser = await authService.processAuthCode(code)
        
        // Formatear los datos para el contexto de autenticación
        const googleUserData: GoogleUser = {
          id: googleUser.sub || googleUser.id || generateId(),
          email: googleUser.email || 'usuario@gmail.com',
          name: googleUser.name || googleUser.given_name || 'Usuario de Google',
          picture: googleUser.picture || 'https://lh3.googleusercontent.com/a/default-user=s96-c',
          provider: 'google' as const
        }

        console.log('AuthContext - Procesando usuario de Google:', googleUserData)

        // Usar el método loginWithProvider existente
        const result = await loginWithProvider(googleUserData)
        
        if (result.success) {
          console.log('✅ Autenticación OAuth completada exitosamente')
          // La redirección la manejará el ProtectedRoute
        } else {
          console.error('❌ Error en loginWithProvider:', result.message)
        }
        
      } catch (error) {
        console.error('Error procesando retorno OAuth:', error)
      }
    }
  }

  const register = async (name: string, email: string, password: string): Promise<{ success: boolean; message: string }> => {
    setIsLoading(true)
    
    try {
      // Validar datos de entrada
      if (!ValidationUtils.isValidEmail(email)) {
        return { success: false, message: 'El email no es válido' }
      }

      if (password.length < 6) {
        return { success: false, message: 'La contraseña debe tener al menos 6 caracteres' }
      }

      if (!name.trim()) {
        return { success: false, message: 'El nombre es requerido' }
      }

      // Verificar si el usuario ya existe
      const existingUsers = StorageUtils.loadFromLocalStorage<User[]>('findia_users') || []
      const userExists = existingUsers.some(u => u.email.toLowerCase() === email.toLowerCase())
      
      if (userExists) {
        return { success: false, message: 'Ya existe un usuario con este email' }
      }

      // Crear nuevo usuario
      const newUser: User = {
        id: generateId(),
        email: email.toLowerCase(),
        name: name.trim(),
        createdAt: new Date().toISOString()
      }

      // Guardar usuario en la lista de usuarios (simulando una base de datos)
      const updatedUsers = [...existingUsers, newUser]
      StorageUtils.saveToLocalStorage('findia_users', updatedUsers)
      
      // Guardar contraseña encriptada (básico para demo)
      const passwordHash = btoa(password) // Muy básico, en producción usar bcrypt
      StorageUtils.saveToLocalStorage(`findia_password_${newUser.id}`, passwordHash)

      // Iniciar sesión automáticamente después del registro
      const sessionToken = generateId()
      StorageUtils.saveToLocalStorage('findia_session', sessionToken)
      StorageUtils.saveToLocalStorage('findia_user', newUser)
      
      setUser(newUser)

      return { success: true, message: '¡Cuenta creada exitosamente! Bienvenido a FindIA 🎉' }
      
    } catch (error) {
      console.error('Registration error:', error)
      return { success: false, message: 'Error al crear la cuenta. Inténtalo de nuevo.' }
    } finally {
      setIsLoading(false)
    }
  }

  const login = async (email: string, password: string): Promise<{ success: boolean; message: string }> => {
    setIsLoading(true)
    
    try {
      // Validar datos de entrada
      if (!ValidationUtils.isValidEmail(email)) {
        return { success: false, message: 'Email no válido' }
      }

      if (!password) {
        return { success: false, message: 'La contraseña es requerida' }
      }

      // Buscar usuario
      const existingUsers = StorageUtils.loadFromLocalStorage<User[]>('findia_users') || []
      const foundUser = existingUsers.find(u => u.email.toLowerCase() === email.toLowerCase())
      
      if (!foundUser) {
        return { success: false, message: 'Usuario no encontrado' }
      }

      // Verificar contraseña
      const storedPasswordHash = StorageUtils.loadFromLocalStorage<string>(`findia_password_${foundUser.id}`)
      const inputPasswordHash = btoa(password)
      
      if (storedPasswordHash !== inputPasswordHash) {
        return { success: false, message: 'Contraseña incorrecta' }
      }

      // Crear sesión
      const sessionToken = generateId()
      StorageUtils.saveToLocalStorage('findia_session', sessionToken)
      StorageUtils.saveToLocalStorage('findia_user', foundUser)
      
      setUser(foundUser)

      return { success: true, message: `¡Bienvenido de vuelta, ${foundUser.name}! 😊` }
      
    } catch (error) {
      console.error('Login error:', error)
      return { success: false, message: 'Error al iniciar sesión. Inténtalo de nuevo.' }
    } finally {
      setIsLoading(false)
    }
  }

  const loginWithProvider = async (providerData: GoogleUser): Promise<{ success: boolean; message: string }> => {
    setIsLoading(true)
    
    try {
      // Verificar si el usuario ya existe
      const existingUsers = StorageUtils.loadFromLocalStorage<User[]>('findia_users') || []
      let existingUser = existingUsers.find(u => u.email.toLowerCase() === providerData.email.toLowerCase())
      
      if (existingUser) {
        // Usuario existe, actualizar información del provider
        existingUser.picture = providerData.picture
        existingUser.provider = providerData.provider
        
        // Actualizar en localStorage
        const updatedUsers = existingUsers.map(u => 
          u.id === existingUser!.id ? existingUser! : u
        )
        StorageUtils.saveToLocalStorage('findia_users', updatedUsers)
      } else {
        // Crear nuevo usuario desde provider
        existingUser = {
          id: generateId(),
          email: providerData.email.toLowerCase(),
          name: providerData.name,
          picture: providerData.picture,
          provider: providerData.provider,
          createdAt: new Date().toISOString()
        }
        
        // Agregar a la lista de usuarios
        const updatedUsers = [...existingUsers, existingUser]
        StorageUtils.saveToLocalStorage('findia_users', updatedUsers)
      }

      // Iniciar sesión
      const sessionToken = generateId()
      StorageUtils.saveToLocalStorage('findia_session', sessionToken)
      StorageUtils.saveToLocalStorage('findia_user', existingUser)
      
      setUser(existingUser)

      return { 
        success: true, 
        message: `¡Bienvenido ${existingUser.name}! Has iniciado sesión con ${providerData.provider} 🎉` 
      }
      
    } catch (error) {
      console.error('Provider login error:', error)
      return { success: false, message: 'Error al iniciar sesión con el proveedor. Inténtalo de nuevo.' }
    } finally {
      setIsLoading(false)
    }
  }

  const logout = () => {
    // Limpiar datos de sesión
    StorageUtils.removeFromLocalStorage('findia_session')
    StorageUtils.removeFromLocalStorage('findia_user')
    
    setUser(null)
  }

  const value: AuthContextType = {
    user,
    login,
    register,
    loginWithProvider,
    logout,
    isLoading
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export default AuthContext