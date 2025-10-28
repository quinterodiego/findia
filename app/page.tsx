'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import Image from 'next/image'
import { 
  Sparkles, 
  Target, 
  TrendingUp, 
  Shield, 
  Users, 
  Star,
  ArrowRight,
  BarChart3,
  Zap,
  Heart,
  Trophy,
  Sun,
  Moon
} from 'lucide-react'
import AuthModal from '@/components/AuthModal'

export default function Home() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')

  useEffect(() => {
    if (status === 'authenticated') {
      router.push('/dashboard')
    }
  }, [status, router])

  // Cargar tema guardado
  useEffect(() => {
    const savedTheme = localStorage.getItem('findia-theme')
    if (savedTheme === 'dark') {
      setIsDarkMode(true)
      document.documentElement.classList.add('dark')
    }
  }, [])

  const toggleDarkMode = () => {
    const newMode = !isDarkMode
    setIsDarkMode(newMode)
    
    if (newMode) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('findia-theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('findia-theme', 'light')
    }
  }

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
      icon: Target,
      title: "Seguimiento Inteligente",
      description: "Rastrea tus gastos y pagos con visualizaciones claras y progreso en tiempo real."
    },
    {
      icon: Sparkles,
      title: "IA Personal Coach",
      description: "Recibe estrategias personalizadas y consejos inteligentes para optimizar tus pagos."
    },
    {
      icon: TrendingUp,
      title: "Progreso Motivador",
      description: "Celebra cada hito alcanzado con animaciones y seguimiento visual de tu progreso."
    },
    {
      icon: Shield,
      title: "Datos Seguros",
      description: "Tus datos financieros se almacenan de forma segura con NextAuth y Google OAuth."
    }
  ]

  const testimonials = [
    {
      name: "María González",
      role: "Profesional de Marketing",
      avatar: "👩🏻‍💼",
      text: "FindIA me ayudó a salir de $15,000 en deudas en solo 18 meses. Las estrategias de IA fueron increíbles!",
      rating: 5
    },
    {
      name: "Carlos Ruiz", 
      role: "Ingeniero de Software",
      avatar: "👨🏻‍💻",
      text: "La interfaz es súper intuitiva y las celebraciones me mantuvieron motivado durante todo el proceso.",
      rating: 5
    },
    {
      name: "Ana Martín",
      role: "Emprendedora",
      avatar: "👩🏻‍🚀",
      text: "Pasé de tener 5 tarjetas de crédito al máximo a estar completamente libre de deudas. ¡Gracias FindIA!",
      rating: 5
    }
  ]

  const stats = [
    { number: "10,000+", label: "Usuarios Activos", icon: Users },
    { number: "$2.5M+", label: "Deuda Eliminada", icon: TrendingUp },
    { number: "98%", label: "Tasa de Éxito", icon: Trophy },
    { number: "4.9★", label: "Calificación", icon: Star }
  ]

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
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
              <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                FindIA
              </span>
            </motion.div>
            
            <div className="flex items-center space-x-2 sm:space-x-4">
              <button
                onClick={toggleDarkMode}
                className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                title={isDarkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              >
                {isDarkMode ? <Sun className="w-5 h-5 text-yellow-500" /> : <Moon className="w-5 h-5 text-gray-600 dark:text-gray-400" />}
              </button>
              
              <button
                onClick={handleLogin}
                className="text-gray-600 dark:text-gray-300 font-medium text-sm sm:text-base cursor-pointer px-3 sm:px-4 py-2 rounded-lg border-1 hover:border-blue-500 dark:hover:bg-blue-950/20 border-gray-600 hover:text-blue-500 hover:scale-105"
              >
                <span className="hidden sm:inline">Ingresar</span>
                <span className="sm:hidden">Ingresar</span>
              </button>
              <button
                onClick={handleGetStarted}
                className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-3 sm:px-6 py-2 rounded-lg font-semibold hover:from-blue-600 hover:to-purple-700 transition-all duration-200 text-sm sm:text-base cursor-pointer transform hover:scale-105"
              >
                <span className="hidden sm:inline">Empezar Gratis</span>
                <span className="sm:hidden">Empezar</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-24 pb-20 bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-800 dark:via-gray-900 dark:to-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white mb-6 leading-tight">
                Tu{' '}
                <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Libertad Financiera
                </span>
                <br />
                Comienza Hoy 🚀
              </h1>
              
              <p className="text-lg sm:text-xl md:text-2xl text-gray-600 dark:text-gray-300 mb-8 max-w-3xl mx-auto px-4 sm:px-0">
                FindIA es tu compañero inteligente para salir de las deudas. 
                Estrategias personalizadas, seguimiento motivador y IA que te guía paso a paso.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 justify-center items-center mb-12 px-4 sm:px-0">
                <motion.button
                  onClick={handleGetStarted}
                  className="w-full sm:w-auto bg-gradient-to-r from-blue-500 to-purple-600 text-white px-6 sm:px-8 py-4 rounded-xl font-semibold text-base sm:text-lg hover:from-blue-600 hover:to-purple-700 transition-all duration-200 flex items-center justify-center space-x-2 shadow-lg"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <span className="hidden sm:inline">Empezar Mi Transformación</span>
                  <span className="sm:hidden">Empezar Transformación</span>
                  <ArrowRight className="h-5 w-5" />
                </motion.button>
                
                <button 
                  onClick={() => router.push('/dashboard')}
                  className="w-full sm:w-auto text-gray-600 hover:text-gray-800 font-semibold text-base sm:text-lg flex items-center justify-center space-x-1 transition-colors duration-200 cursor-pointer"
                >
                  <span>Ver Dashboard</span>
                  <motion.div animate={{ x: [0, 5, 0] }} transition={{ repeat: Infinity, duration: 1.5 }}>
                    ▶️
                  </motion.div>
                </button>
              </div>
            </motion.div>

            {/* Hero Stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto"
            >
              {stats.map((stat, index) => (
                <div key={index} className="text-center">
                  <div className="bg-white/70 backdrop-blur-sm dark:bg-gray-700 dark:backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-gray-100 dark:border-gray-600 hover:shadow-xl transition-all duration-300">
                    <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-3 rounded-xl w-fit mx-auto mb-3">
                      <stat.icon className="h-6 w-6 text-white" />
                    </div>
                    <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">{stat.number}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">{stat.label}</div>
                  </div>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>
      {/* Features Section */}
      <section className="py-20 bg-white dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              ¿Por qué elegir FindIA? ✨
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Herramientas inteligentes diseñadas para acelerar tu camino hacia la libertad financiera
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-700 dark:to-gray-800 rounded-2xl p-6 shadow-lg border border-gray-100 dark:border-gray-600 hover:shadow-xl transition-all duration-300"
              >
                <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-3 rounded-xl w-fit mb-4">
                  <feature.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{feature.title}</h3>
                <p className="text-gray-600 dark:text-gray-300">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-20 bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-800 dark:to-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              3 Pasos Hacia Tu Libertad 🎯
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              Proceso simple y efectivo para transformar tu situación financiera
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: 1,
                title: "Registra tus Gastos y Deudas",
                description: "Añade todos tus gastos y deudas y obtén un panorama claro de tu situación actual",
                icon: BarChart3,
                color: "from-blue-400 to-cyan-400"
              },
              {
                step: 2,
                title: "Recibe tu Estrategia",
                description: "La IA analiza tu perfil y crea un plan personalizado de pagos",
                icon: Zap,
                color: "from-purple-400 to-pink-400"
              },
              {
                step: 3,
                title: "Ejecuta y Celebra",
                description: "Sigue el plan, registra pagos y celebra cada hito alcanzado",
                icon: Heart,
                color: "from-green-400 to-emerald-400"
              }
            ].map((step, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.2 }}
                className="relative bg-white dark:bg-gray-700 rounded-2xl p-8 shadow-lg text-center hover:shadow-xl transition-all duration-300"
              >
                <div className={`bg-gradient-to-r ${step.color} w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6`}>
                  <step.icon className="h-8 w-8 text-white" />
                </div>
                <div className="absolute -top-4 -right-4 bg-gray-900 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm">
                  {step.step}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">{step.title}</h3>
                <p className="text-gray-600 dark:text-gray-300">{step.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-white dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Historias de Éxito Reales 🌟
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              Miles de personas han transformado sus vidas financieras con FindIA
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-700 dark:to-gray-800 rounded-2xl p-6 shadow-lg border border-gray-100 dark:border-gray-600 hover:shadow-xl transition-all duration-300"
              >
                <div className="flex items-center mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                  ))}
                </div>
                <p className="text-gray-700 dark:text-gray-300 mb-6 italic">&quot;{testimonial.text}&quot;</p>
                <div className="flex items-center">
                  <div className="text-3xl mr-3">{testimonial.avatar}</div>
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-white">{testimonial.name}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">{testimonial.role}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-purple-700">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              ¿Listo para tu Transformación? 🚀
            </h2>
            <p className="text-xl text-blue-100 mb-8">
              Únete a miles de personas que han recuperado su libertad financiera
            </p>
            <motion.button
              onClick={handleGetStarted}
              className="bg-white text-blue-600 px-8 py-4 rounded-xl font-bold text-lg hover:bg-gray-100 transition-all duration-200 shadow-lg cursor-pointer"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Comenzar Gratis Ahora ✨
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
                <p className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  FindIA
                </p>
              </div>
              <p className="text-gray-400 mb-4">
                Tu compañero inteligente para alcanzar la libertad financiera. 
                Estrategias personalizadas, seguimiento motivador y resultados reales.
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold mb-4">Producto</h3>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Características</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Precios</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Testimonios</a></li>
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
