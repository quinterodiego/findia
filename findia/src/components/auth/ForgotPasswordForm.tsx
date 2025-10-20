import { useState } from 'react'
import { motion } from 'framer-motion'
import { Mail, ArrowLeft, CheckCircle, Send } from 'lucide-react'
import { FeedbackMessage, ButtonWithLoading } from './FeedbackComponents'

interface ForgotPasswordFormProps {
  onBack: () => void
  onClose?: () => void
}

export const ForgotPasswordForm: React.FC<ForgotPasswordFormProps> = ({ onBack, onClose }) => {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null)
  const [emailSent, setEmailSent] = useState(false)

  const validateEmail = (email: string): string | undefined => {
    if (!email) return 'El email es requerido'
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) return 'Formato de email inválido'
    return undefined
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)

    const emailError = validateEmail(email)
    if (emailError) {
      setMessage({ type: 'error', text: emailError })
      return
    }

    setIsLoading(true)

    try {
      // Simular envío de email (en producción aquí iría la llamada a la API)
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      setEmailSent(true)
      setMessage({ 
        type: 'success', 
        text: 'Si existe una cuenta con este email, recibirás instrucciones para restablecer tu contraseña.' 
      })
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: 'Error al enviar el email. Inténtalo de nuevo.' 
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleTryAgain = () => {
    setEmailSent(false)
    setMessage(null)
    setEmail('')
  }

  // Navegación por teclado
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && email && !isLoading) {
      e.preventDefault()
      const form = document.querySelector('form') as HTMLFormElement
      form?.requestSubmit()
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-md mx-auto"
    >
      <div className="bg-white rounded-2xl shadow-2xl p-8 pt-16">
        <div className="text-center mb-6">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4"
          >
            {emailSent ? (
              <CheckCircle className="h-8 w-8 text-blue-600" />
            ) : (
              <Mail className="h-8 w-8 text-blue-600" />
            )}
          </motion.div>
          
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {emailSent ? '¡Email enviado! 📧' : '¿Olvidaste tu contraseña? 🔐'}
          </h2>
          
          <p className="text-gray-600">
            {emailSent 
              ? 'Revisa tu bandeja de entrada y sigue las instrucciones.'
              : 'No te preocupes, te enviaremos instrucciones para restablecerla.'
            }
          </p>
        </div>

        {message && (
          <FeedbackMessage
            type={message.type === 'error' ? 'error' : 'success'}
            message={message.text}
            className="mb-4"
          />
        )}

        {!emailSent ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Correo Electrónico
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  placeholder="tu@email.com"
                  required
                  autoComplete="email"
                  tabIndex={1}
                />
              </div>
            </div>

            <ButtonWithLoading
              type="submit"
              isLoading={isLoading}
              loadingText="Enviando..."
              disabled={isLoading}
            >
              <div className="flex items-center justify-center space-x-2">
                <Send className="h-5 w-5" />
                <span>Enviar Instrucciones</span>
              </div>
            </ButtonWithLoading>
          </form>
        ) : (
          <div className="space-y-4">
            <ButtonWithLoading
              onClick={handleTryAgain}
              variant="secondary"
              isLoading={false}
            >
              Intentar con otro email
            </ButtonWithLoading>
            
            <button
              onClick={onClose}
              className="w-full text-blue-600 hover:text-blue-700 font-medium transition-colors duration-200"
            >
              Cerrar
            </button>
          </div>
        )}

        <div className="mt-6 text-center">
          <button
            onClick={onBack}
            className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium transition-colors duration-200"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Volver al inicio de sesión
          </button>
        </div>
      </div>
    </motion.div>
  )
}