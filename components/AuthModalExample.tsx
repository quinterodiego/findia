// Ejemplo de cómo usar el AuthModal en cualquier componente

'use client'

import { useState } from 'react'
import AuthModal from '@/components/AuthModal'

export default function ExampleUsage() {
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')

  const handleOpenLogin = () => {
    setAuthMode('login')
    setShowAuthModal(true)
  }

  const handleOpenRegister = () => {
    setAuthMode('register')
    setShowAuthModal(true)
  }

  return (
    <div>
      {/* Botones para abrir el modal */}
      <button onClick={handleOpenLogin}>
        Iniciar Sesión
      </button>
      
      <button onClick={handleOpenRegister}>
        Registrarse
      </button>

      {/* El Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        initialMode={authMode}
      />
    </div>
  )
}

/* 
PARA USAR EN LA LANDING PAGE (app/page.tsx):

1. Importa el componente:
   import AuthModal from '@/components/AuthModal'

2. Agrega los estados:
   const [showAuthModal, setShowAuthModal] = useState(false)
   const [authMode, setAuthMode] = useState<'login' | 'register'>('login')

3. Modifica los handlers:
   const handleGetStarted = () => {
     setAuthMode('register')
     setShowAuthModal(true)
   }

   const handleLogin = () => {
     setAuthMode('login')
     setShowAuthModal(true)
   }

4. Agrega el modal antes del cierre del componente:
   <AuthModal
     isOpen={showAuthModal}
     onClose={() => setShowAuthModal(false)}
     initialMode={authMode}
   />

NOTA: Actualmente la landing page usa signIn('google') directamente,
que es más simple y efectivo para Google OAuth. Usa este modal si 
quieres agregar autenticación con email/password en el futuro.
*/
