"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { useDebtStore } from "@/store"
import { Button } from "@/components/ui/button"
import { PlusCircle, DollarSign, TrendingDown, Target, Calendar } from "lucide-react"

export default function Dashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { debts, loadDebts } = useDebtStore()
  const [loading, setLoading] = useState(true)

  const [isDarkMode, setIsDarkMode] = useState(false)

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

  // Cargar tema guardado
  useEffect(() => {
    const savedTheme = localStorage.getItem('findia-theme');
    const isDark = savedTheme === 'dark';
    setIsDarkMode(isDark);
    
    if (isDark) {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
      // Aplicar estilos dark mode con un pequeño delay para asegurar que el DOM esté listo
      setTimeout(applyDarkModeStyles, 100);
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }
  }, []);

  const applyDarkModeStyles = () => {
    console.log('Aplicando estilos dark mode directos...');
    
    // Cambiar fondo del body
    document.body.style.setProperty('background', 'linear-gradient(135deg, #111827 0%, #1f2937 50%, #1e3a8a 100%)', 'important');
    
    // Buscar y forzar TODOS los elementos bg-white
    const whiteElements = document.querySelectorAll('.bg-white');
    console.log(`Encontrados ${whiteElements.length} elementos bg-white`);
    
    whiteElements.forEach((el, index) => {
      const element = el as HTMLElement;
      element.style.setProperty('background-color', '#1f2937', 'important');
      element.style.setProperty('border-color', '#374151', 'important');
      console.log(`Elemento ${index + 1} forzado a dark`);
    });
    
    // Cambiar textos oscuros
    const darkTexts = document.querySelectorAll('.text-gray-900, .text-gray-700, .text-gray-600');
    darkTexts.forEach(el => {
      const element = el as HTMLElement;
      element.style.setProperty('color', '#d1d5db', 'important');
    });
    
    // Forzar re-render
    document.body.style.display = 'none';
    document.body.offsetHeight;
    document.body.style.display = '';
    
    console.log('Dark mode forzado aplicado');
  };

  const removeDarkModeStyles = () => {
    console.log('Removiendo estilos dark mode...');
    
    // Restaurar fondo del body
    document.body.style.removeProperty('background');
    
    // Remover estilos forzados de TODOS los elementos
    const allElements = document.querySelectorAll('*');
    let removedCount = 0;
    
    allElements.forEach(el => {
      const element = el as HTMLElement;
      if (element.style.backgroundColor) {
        element.style.removeProperty('background-color');
        removedCount++;
      }
      if (element.style.color) {
        element.style.removeProperty('color');
        removedCount++;
      }
      if (element.style.borderColor) {
        element.style.removeProperty('border-color');
        removedCount++;
      }
    });
    
    console.log(`Removidos ${removedCount} estilos forzados`);
  };

  const toggleDarkMode = () => {
    const newDarkMode = !isDarkMode;
    setIsDarkMode(newDarkMode);
    
    console.log('Toggling dark mode:', newDarkMode);
    
    const html = document.documentElement;
    
    if (newDarkMode) {
      html.classList.remove('light');
      html.classList.add('dark');
      localStorage.setItem('findia-theme', 'dark');
      // Aplicar estilos forzados
      setTimeout(applyDarkModeStyles, 50);
    } else {
      html.classList.remove('dark');
      html.classList.add('light');
      localStorage.setItem('findia-theme', 'light');
      // Remover estilos forzados
      removeDarkModeStyles();
    }
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
  const progressPercentage = totalPaid / (totalPaid + totalDebt) * 100

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
              {/* BOTÓN DARK MODE TOGGLE */}
              <button 
                onClick={toggleDarkMode}
                className={`px-4 py-2 rounded-lg font-bold cursor-pointer transition-all duration-200 ${
                  isDarkMode 
                    ? 'bg-yellow-500 hover:bg-yellow-600 text-gray-900' 
                    : 'bg-purple-500 hover:bg-purple-600 text-white'
                }`}
                title={isDarkMode ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
              >
                {isDarkMode ? '☀️ LIGHT' : '🌙 DARK'}
              </button>

              {/* BOTÓN FORZAR DARK MODE - DIRECTO */}
              <button 
                onClick={() => {
                  console.log('Force direct styling');
                  const html = document.documentElement;
                  const currentlyDark = html.classList.contains('dark');
                  
                  if (currentlyDark) {
                    html.classList.remove('dark');
                    html.classList.add('light');
                    removeDarkModeStyles();
                  } else {
                    html.classList.add('dark');
                    html.classList.remove('light');
                    applyDarkModeStyles();
                  }
                }}
                className="px-3 py-2 bg-red-500 text-white rounded-lg text-sm cursor-pointer hover:bg-red-600"
              >
                FORCE JS
              </button>

              <span className="text-gray-700 dark:text-gray-300">
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-blue-100 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Deuda Total</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  ${totalDebt.toLocaleString()}
                </p>
              </div>
              <div className="bg-red-100 dark:bg-red-900/30 p-3 rounded-full">
                <DollarSign className="h-6 w-6 text-red-600 dark:text-red-400" />
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
                <TrendingDown className="h-6 w-6 text-green-600 dark:text-green-400" />
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
                  {progressPercentage.toFixed(1)}%
                </p>
              </div>
              <div className="bg-purple-100 dark:bg-purple-900/30 p-3 rounded-full">
                <Target className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-100 dark:border-gray-700 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Progreso General</h3>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {progressPercentage.toFixed(1)}% completado
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4">
            <div 
              className="bg-gradient-to-r from-blue-500 to-purple-600 h-4 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(progressPercentage, 100)}%` }}
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
              >
                <PlusCircle className="h-4 w-4 mr-2" />
                Agregar Deuda
              </Button>
            </div>
          </div>

          <div className="p-6">
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

      {/* BOTÓN DE PRUEBA TEMPORAL */}
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => {
            alert('¡JavaScript funciona!');
            console.log('=== INICIANDO DEBUG ===');
            
            // Test 1: Cambiar color del botón para confirmar que funciona
            const button = document.querySelector('.bg-red-600') as HTMLElement;
            if (button) {
              button.style.backgroundColor = 'green';
              console.log('Botón cambiado a verde');
            }
            
            // Test 2: Cambiar fondo del body de forma muy simple
            document.body.style.backgroundColor = 'red';
            console.log('Fondo del body cambiado a rojo');
            
            // Test 3: Buscar elementos bg-white
            const whiteElements = document.querySelectorAll('.bg-white');
            console.log(`Encontrados ${whiteElements.length} elementos bg-white`);
            
            if (whiteElements.length > 0) {
              const firstElement = whiteElements[0] as HTMLElement;
              firstElement.style.backgroundColor = 'blue';
              console.log('Primer elemento bg-white cambiado a azul');
            }
            
            console.log('=== DEBUG COMPLETO ===');
          }}
          className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-full shadow-lg cursor-pointer font-bold"
        >
          🔥 FORCE DARK
        </button>
      </div>

    </div>
  )
}