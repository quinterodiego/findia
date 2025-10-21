"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { useDebtStore } from "@/store"
import { Button } from "@/components/ui/button"
import { PlusCircle, DollarSign, TrendingDown, Target, Calendar } from "lucide-react"
import TourGuide from "@/components/TourGuide"

export default function Dashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { debts, loadDebts } = useDebtStore()
  const [loading, setLoading] = useState(true)

  const [isDarkMode, setIsDarkMode] = useState(false)
  const [showTour, setShowTour] = useState(false)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/")
    }
  }, [status, router])

  useEffect(() => {
    if (session) {
      loadDebts().finally(() => setLoading(false))
    }
  }, [session, loadDebts])

  // Inicializar tema con light mode por defecto
  useEffect(() => {
    const savedTheme = localStorage.getItem('findia-theme');
    const shouldBeDark = savedTheme === 'dark';
    
    setIsDarkMode(shouldBeDark);
    
    if (shouldBeDark) {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
      localStorage.setItem('findia-theme', 'dark');
      setTimeout(applyDarkModeStyles, 100);
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
      localStorage.setItem('findia-theme', 'light');
      removeDarkModeStyles();
    }
  }, []);

  // Verificar si es la primera visita para mostrar el tour
  useEffect(() => {
    const hasSeenTour = localStorage.getItem('findia-tour-completed');
    if (!hasSeenTour && debts.length === 0 && !loading) {
      setShowTour(true);
    }
  }, [debts, loading]);  const applyDarkModeStyles = () => {
    // Remover CSS de light mode si existe
    const lightModeStyle = document.getElementById('findia-light-mode');
    if (lightModeStyle) {
      lightModeStyle.remove();
    }
    
    // Remover CSS dark anterior si existe
    const existingStyle = document.getElementById('findia-dark-mode');
    if (existingStyle) {
      existingStyle.remove();
    }
    
    // Aplicar dark mode
    const style = document.createElement('style');
    style.id = 'findia-dark-mode';
    style.innerHTML = `
      * {
        transition: all 0.3s ease !important;
      }
      
      body {
        background: linear-gradient(135deg, #111827 0%, #1f2937 50%, #1e3a8a 100%) !important;
        color: #f9fafb !important;
      }
      
      .bg-white,
      .bg-gray-50,
      .bg-gray-100,
      div.bg-white,
      header.bg-white,
      [class*="bg-white"] {
        background: #1f2937 !important;
        background-color: #1f2937 !important;
        background-image: none !important;
        border-color: #374151 !important;
        color: #f9fafb !important;
      }
      
      .text-gray-900,
      .text-gray-700,
      .text-gray-600,
      .text-gray-500,
      .text-gray-400,
      [class*="text-gray"] {
        color: #d1d5db !important;
      }
      
      .border-gray-100,
      .border-gray-200,
      .border-blue-100,
      .border-green-100,
      .border-purple-100 {
        border-color: #374151 !important;
      }
      
      .min-h-screen {
        background: linear-gradient(135deg, #111827 0%, #1f2937 50%, #1e3a8a 100%) !important;
      }
    `;
    
    document.head.appendChild(style);
  };

  const removeDarkModeStyles = () => {
    // Remover el CSS dinámico dark si existe
    const darkModeStyle = document.getElementById('findia-dark-mode');
    if (darkModeStyle) {
      darkModeStyle.remove();
    }
    
    // Aplicar light mode
    const existingLightStyle = document.getElementById('findia-light-mode');
    if (existingLightStyle) {
      existingLightStyle.remove();
    }
    
    const lightStyle = document.createElement('style');
    lightStyle.id = 'findia-light-mode';
    lightStyle.innerHTML = `
      * {
        transition: all 0.3s ease !important;
      }
      
      body {
        background: linear-gradient(to bottom right, rgb(239, 246, 255), rgb(255, 255, 255), rgb(252, 231, 243)) !important;
        color: rgb(17, 24, 39) !important;
      }
      
      .bg-white,
      .bg-gray-50,
      .bg-gray-100,
      div.bg-white,
      header.bg-white,
      [class*="bg-white"] {
        background: rgb(255, 255, 255) !important;
        background-color: rgb(255, 255, 255) !important;
        background-image: none !important;
        border-color: rgb(229, 231, 235) !important;
        color: rgb(17, 24, 39) !important;
      }
      
      /* Arreglar textos - más oscuros y legibles */
      .text-gray-900 {
        color: rgb(17, 24, 39) !important;
      }
      .text-gray-700 {
        color: rgb(55, 65, 81) !important;
      }
      .text-gray-600 {
        color: rgb(75, 85, 99) !important;
      }
      .text-gray-500 {
        color: rgb(107, 114, 128) !important;
      }
      .text-gray-400 {
        color: rgb(156, 163, 175) !important;
      }
      
      /* Arreglar iconos - hacer más visibles */
      .bg-red-100 {
        background-color: rgb(254, 226, 226) !important;
        color: rgb(127, 29, 29) !important;
      }
      .bg-green-100 {
        background-color: rgb(220, 252, 231) !important;
        color: rgb(20, 83, 45) !important;
      }
      .bg-blue-100 {
        background-color: rgb(219, 234, 254) !important;
        color: rgb(30, 58, 138) !important;
      }
      .bg-purple-100 {
        background-color: rgb(237, 233, 254) !important;
        color: rgb(88, 28, 135) !important;
      }
      
      /* Arreglar botones con degradé - general */
      .bg-gradient-to-r:not(h1):not(.text-transparent) {
        background: linear-gradient(to right, rgb(37, 99, 235), rgb(147, 51, 234)) !important;
        color: white !important;
        font-weight: 600 !important;
        border: none !important;
      }
      
      /* Arreglar botones específicos de agregar deuda */
      button.bg-gradient-to-r,
      .bg-gradient-to-r.from-blue-600.to-purple-600:not(h1) {
        background: linear-gradient(to right, rgb(37, 99, 235), rgb(147, 51, 234)) !important;
        color: white !important;
        font-weight: 600 !important;
        border: none !important;
      }
      
      /* Arreglar logo FindIA en light mode */
      h1.bg-gradient-to-r.from-blue-600.to-purple-600 {
        background: linear-gradient(to right, rgb(37, 99, 235), rgb(147, 51, 234)) !important;
        background-clip: text !important;
        -webkit-background-clip: text !important;
        color: transparent !important;
        font-weight: bold !important;
      }
      
      /* Asegurar que los iconos dentro de las cards sean visibles */
      .text-red-600,
      .text-green-600,
      .text-blue-600,
      .text-purple-600 {
        opacity: 1 !important;
      }
      
      .border-gray-100,
      .border-gray-200,
      .border-blue-100,
      .border-green-100,
      .border-purple-100 {
        border-color: rgb(229, 231, 235) !important;
      }
      
      .min-h-screen {
        background: linear-gradient(to bottom right, rgb(239, 246, 255), rgb(255, 255, 255), rgb(252, 231, 243)) !important;
      }
    `;
    
    document.head.appendChild(lightStyle);
  };

  const toggleDarkMode = () => {
    const newDarkMode = !isDarkMode;
    setIsDarkMode(newDarkMode);
    
    const html = document.documentElement;
    
    if (newDarkMode) {
      html.classList.remove('light');
      html.classList.add('dark');
      localStorage.setItem('findia-theme', 'dark');
      setTimeout(applyDarkModeStyles, 50);
    } else {
      html.classList.remove('dark');
      html.classList.add('light');
      localStorage.setItem('findia-theme', 'light');
      removeDarkModeStyles();
    }
  };

  const handleTourComplete = () => {
    setShowTour(false);
    localStorage.setItem('findia-tour-completed', 'true');
  };

  const handleTourSkip = () => {
    setShowTour(false);
    localStorage.setItem('findia-tour-completed', 'true');
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  const totalDebt = debts.reduce((sum, debt) => sum + debt.currentAmount, 0)
  const totalPaid = debts.reduce((sum, debt) => sum + (debt.originalAmount - debt.currentAmount), 0)
  const monthlyPayments = debts.reduce((sum, debt) => sum + debt.minimumPayment, 0)
  
  // Evitar NaN cuando no hay deudas
  const totalAmount = totalPaid + totalDebt
  const progressPercentage = totalAmount > 0 ? (totalPaid / totalAmount) * 100 : 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900">
      {/* Header */}
      <header className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-sm border-b border-blue-100 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                FindIA
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              {/* BOTÓN TOUR */}
              <button
                onClick={() => setShowTour(true)}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200 cursor-pointer"
                title="Iniciar tour guiado"
              >
                <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>

              {/* BOTÓN DARK MODE TOGGLE */}
              <button
                onClick={toggleDarkMode}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200 cursor-pointer"
                title={isDarkMode ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
                data-tour="theme-toggle"
              >
                {isDarkMode ? (
                  <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                  </svg>
                )}
              </button>              <span className="text-gray-700 dark:text-gray-300">
                Hola, {session.user?.name?.split(' ')[0]}!
              </span>
              <Button
                onClick={() => router.push("/api/auth/signout")}
                variant="outline"
                className="border-blue-600 text-blue-600 hover:bg-blue-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 cursor-pointer"
              >
                Cerrar Sesión
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Overview */}
                {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8" data-tour="stats">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-red-100 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Deudas</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  ${totalDebt.toLocaleString()}
                </p>
              </div>
              <div className="bg-red-100 dark:bg-red-900/30 p-3 rounded-full">
                <TrendingDown className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-green-100 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Pagado</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  ${totalPaid.toLocaleString()}
                </p>
              </div>
              <div className="bg-green-100 dark:bg-green-900/30 p-3 rounded-full">
                <DollarSign className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-blue-100 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Pago Mensual</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  ${monthlyPayments.toLocaleString()}
                </p>
              </div>
              <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-full">
                <Calendar className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-purple-100 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Progreso</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {(progressPercentage || 0).toFixed(1)}%
                </p>
              </div>
              <div className="bg-purple-100 dark:bg-purple-900/30 p-3 rounded-full">
                <Target className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-100 dark:border-gray-700 mb-8" data-tour="progress">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Progreso General</h3>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {(progressPercentage || 0).toFixed(1)}% completado
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4">
            <div 
              className="bg-gradient-to-r from-blue-500 to-purple-600 h-4 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(progressPercentage || 0, 100)}%` }}
            ></div>
          </div>
        </div>

        {/* Debts List */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700">
          <div className="p-6 border-b border-gray-100 dark:border-gray-700">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Mis Deudas</h2>
              <Button
                onClick={() => router.push("/debt/new")}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                data-tour="add-debt"
              >
                <PlusCircle className="h-4 w-4 mr-2" />
                Agregar Deuda
              </Button>
            </div>
          </div>

          <div className="p-6" data-tour="debt-list">
            {debts.length === 0 ? (
              <div className="text-center py-12">
                <DollarSign className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No tienes deudas registradas
                </h3>
                <p className="text-gray-500 dark:text-gray-400 mb-6">
                  ¡Comienza agregando tu primera deuda para comenzar a rastrear tu progreso!
                </p>
                <Button
                  onClick={() => router.push("/debt/new")}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                >
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Agregar Primera Deuda
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {debts.map((debt) => (
                  <div key={debt.id} className="border border-gray-200 dark:border-gray-600 rounded-xl p-4 hover:shadow-md transition-shadow bg-gray-50 dark:bg-gray-700/50">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900 dark:text-white">{debt.name}</h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">{debt.category}</p>
                        <div className="mt-2 flex items-center space-x-4">
                          <span className="text-lg font-bold text-gray-900 dark:text-white">
                            ${debt.currentAmount.toLocaleString()}
                          </span>
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            de ${debt.originalAmount.toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500 dark:text-gray-400">Pago mínimo</p>
                        <p className="font-semibold text-gray-900 dark:text-white">
                          ${debt.minimumPayment.toLocaleString()}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {debt.interestRate}% interés
                        </p>
                      </div>
                    </div>
                    <div className="mt-3">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600 dark:text-gray-300">Progreso</span>
                        <span className="text-gray-600 dark:text-gray-300">{((debt.originalAmount - debt.currentAmount) / debt.originalAmount * 100).toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                        <div 
                          className="bg-gradient-to-r from-green-500 to-green-600 h-2 rounded-full"
                          style={{ width: `${(debt.originalAmount - debt.currentAmount) / debt.originalAmount * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Tour Guide */}
      <TourGuide
        isVisible={showTour}
        onComplete={handleTourComplete}
        onSkip={handleTourSkip}
        hasDebts={debts.length > 0}
      />
    </div>
  )
}