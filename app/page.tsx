'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import Image from 'next/image'
import {
  ClipboardList,
  GitCompare,
  TrendingDown,
  ArrowRight,
  ArrowDown,
  CreditCard,
  Landmark,
  Layers,
  Calculator
} from 'lucide-react'
import AuthModal from '@/components/AuthModal'
import ThemeToggle from '@/components/ThemeToggle'

export default function Home() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')

  useEffect(() => {
    if (status === 'authenticated') {
      router.push('/dashboard')
    }
  }, [status, router])

  const handleGetStarted = () => {
    setAuthMode('register')
    setShowAuthModal(true)
  }

  const handleLogin = () => {
    setAuthMode('login')
    setShowAuthModal(true)
  }

  const features = [
    {
      icon: ClipboardList,
      title: "Registrá tus deudas",
      description: "Cargá cuánto debés, las cuotas, tasas y demás datos de cada deuda."
    },
    {
      icon: GitCompare,
      title: "Elegí una estrategia",
      description: "Compará distintas formas de ordenar tus pagos y encontrá la que mejor se adapte a tu situación."
    },
    {
      icon: TrendingDown,
      title: "Seguí tu progreso",
      description: "Registrá tus pagos y mirá cómo disminuye tu deuda con el tiempo."
    }
  ]

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#FF3A5F]/10 to-[#FF007A]/10">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF3A5F]"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FF3A5F]/5 via-white to-[#FF007A]/5 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header */}
      <header className="fixed top-0 w-full bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <motion.div 
              className="flex items-center transform hover:scale-105 space-x-2"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Image 
                src="/images/logo.png" 
                alt="FindIA Logo" 
                width={40} 
                height={40}
                className="rounded-xl"
              />
              <span className="text-2xl font-bold bg-gradient-to-r from-[#FF3A5F] to-[#FF007A] bg-clip-text text-transparent">
                FindIA
              </span>
            </motion.div>
            
            <div className="flex items-center space-x-2 sm:space-x-4">
              <ThemeToggle />
              
              <button
                onClick={handleLogin}
                className="text-gray-600 dark:text-gray-300 font-medium text-sm sm:text-base cursor-pointer px-3 sm:px-4 py-2 rounded-lg border-1 hover:border-[#FF3A5F] dark:hover:bg-[#FF3A5F]/20 border-gray-600 hover:text-[#FF3A5F] hover:scale-105"
              >
                <span className="hidden sm:inline">Ingresar</span>
                <span className="sm:hidden">Ingresar</span>
              </button>
              <button
                onClick={handleGetStarted}
                className="bg-gradient-to-r from-[#FF3A5F] to-[#FF007A] text-white px-3 sm:px-6 py-2 rounded-lg font-semibold hover:from-[#FF3A5F] hover:to-[#FF007A] hover:opacity-90 transition-all duration-200 text-sm sm:text-base cursor-pointer transform hover:scale-105"
              >
                <span className="hidden sm:inline">Empezar gratis</span>
                <span className="sm:hidden">Empezar</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 sm:pb-24 bg-gradient-to-br from-[#FF3A5F]/5 via-white to-[#FF007A]/5 dark:from-gray-800 dark:via-gray-900 dark:to-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white mb-6 leading-tight">
                Organizá{' '}
                <span className="bg-gradient-to-r from-[#FF3A5F] to-[#FF007A] bg-clip-text text-transparent">
                  tus deudas.
                </span>
                <br />
                Armá un plan para pagarlas.
              </h1>

              <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-300 mb-10 max-w-2xl mx-auto px-4 sm:px-0">
                Registrá lo que debés, compará estrategias de pago y seguí tu progreso.
              </p>

              <div className="flex justify-center px-4 sm:px-0">
                <motion.button
                  onClick={handleGetStarted}
                  className="w-full sm:w-auto bg-gradient-to-r from-[#FF3A5F] to-[#FF007A] text-white px-8 py-4 rounded-xl font-semibold text-base sm:text-lg hover:from-[#FF3A5F] hover:to-[#FF007A] hover:opacity-90 transition-all duration-200 flex items-center justify-center space-x-2 shadow-lg"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <span>Empezar gratis</span>
                  <ArrowRight className="h-5 w-5" />
                </motion.button>
              </div>
            </motion.div>
          </div>
        </div>
      </section>
      {/* Features Section */}
      <section className="py-20 bg-white dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Todo lo que debés, en un solo lugar.
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Registrá tus deudas, compará formas de pagarlas y seguí tu progreso desde un mismo lugar.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-700 dark:to-gray-800 rounded-2xl p-6 shadow-lg border border-gray-100 dark:border-gray-600 hover:shadow-xl transition-all duration-300"
              >
                <div className="bg-gradient-to-br from-[#FF3A5F] to-[#FF007A] p-3 rounded-xl w-fit mb-4">
                  <feature.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{feature.title}</h3>
                <p className="text-gray-600 dark:text-gray-300">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Cómo funciona el análisis */}
      <section className="py-20 bg-gradient-to-br from-white to-[#FF3A5F]/5 dark:from-gray-800 dark:to-gray-900">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Una estrategia para tu situación.
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              FindIA utiliza la información que registrás para ayudarte a analizar tus deudas y entender distintas formas de organizar tus pagos.
            </p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-6"
          >
            {/* Tus deudas */}
            <div className="w-full md:flex-1 bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">
                Tus deudas
              </h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-2">
                  <CreditCard className="h-4 w-4 text-gray-400 shrink-0" />
                  Tarjeta
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-2">
                  <Landmark className="h-4 w-4 text-gray-400 shrink-0" />
                  Préstamo
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-2">
                  <Layers className="h-4 w-4 text-gray-400 shrink-0" />
                  Cuotas
                </div>
              </div>
            </div>

            <ArrowRight className="hidden md:block h-6 w-6 text-gray-300 dark:text-gray-600 shrink-0" />
            <ArrowDown className="md:hidden h-6 w-6 text-gray-300 dark:text-gray-600" />

            {/* Cálculo automático - elemento central */}
            <div className="w-full md:flex-1 bg-gradient-to-br from-[#FF3A5F] to-[#FF007A] rounded-2xl p-8 shadow-lg text-center text-white">
              <div className="bg-white/20 rounded-xl w-14 h-14 flex items-center justify-center mx-auto mb-4">
                <Calculator className="h-7 w-7 text-white" />
              </div>
              <h3 className="font-semibold mb-2">Cálculo automático</h3>
              <p className="text-sm text-white/90">
                FindIA calcula intereses, plazos y ahorro con la información que cargaste.
              </p>
            </div>

            <ArrowRight className="hidden md:block h-6 w-6 text-gray-300 dark:text-gray-600 shrink-0" />
            <ArrowDown className="md:hidden h-6 w-6 text-gray-300 dark:text-gray-600" />

            {/* Estrategia de pago */}
            <div className="w-full md:flex-1 bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                Estrategia de pago
              </h3>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Comparás alternativas y elegís cómo organizar tus pagos.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-[#FF3A5F] to-[#FF007A]">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Empezá a organizar tus deudas hoy
            </h2>
            <p className="text-xl text-white/90 mb-8">
              Creá tu cuenta gratis y armá un plan para pagarlas.
            </p>
            <motion.button
              onClick={handleGetStarted}
              className="bg-white text-[#FF3A5F] px-8 py-4 rounded-xl font-bold text-lg hover:bg-gray-100 transition-all duration-200 shadow-lg cursor-pointer"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Empezar gratis
            </motion.button>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="md:col-span-2">
              <div className="flex items-center space-x-2 mb-4">
                <Image 
                  src="/images/logo.png" 
                  alt="FindIA Logo" 
                  width={40} 
                  height={40}
                  className="rounded-xl"
                />
                <p className="text-2xl font-bold bg-gradient-to-r from-[#FF3A5F] to-[#FF007A] bg-clip-text text-transparent">
                  FindIA
                </p>
              </div>
              <p className="text-gray-400 mb-4">
                Organizá tus deudas, comparás estrategias de pago y seguís tu progreso, todo en un mismo lugar.
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Producto</h3>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Características</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Precios</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold mb-4">Soporte</h3>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Centro de Ayuda</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contacto</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Privacidad</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2025 FindIA. Todos los derechos reservados.</p>
          </div>
        </div>
      </footer>

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        initialMode={authMode}
      />
    </div>
  )
}
