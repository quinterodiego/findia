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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-blue-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                FindIA
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-700">
                Hola, {session.user?.name?.split(' ')[0]}!
              </span>
              <Button
                onClick={() => router.push("/api/auth/signout")}
                variant="outline"
                className="border-blue-600 text-blue-600 hover:bg-blue-50"
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
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-blue-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Deuda Total</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${totalDebt.toLocaleString()}
                </p>
              </div>
              <div className="bg-red-100 p-3 rounded-full">
                <DollarSign className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg border border-green-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Pagado</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${totalPaid.toLocaleString()}
                </p>
              </div>
              <div className="bg-green-100 p-3 rounded-full">
                <TrendingDown className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg border border-blue-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Pago Mensual</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${monthlyPayments.toLocaleString()}
                </p>
              </div>
              <div className="bg-blue-100 p-3 rounded-full">
                <Calendar className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg border border-purple-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Progreso</p>
                <p className="text-2xl font-bold text-gray-900">
                  {progressPercentage.toFixed(1)}%
                </p>
              </div>
              <div className="bg-purple-100 p-3 rounded-full">
                <Target className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Progreso General</h3>
            <span className="text-sm text-gray-500">
              {progressPercentage.toFixed(1)}% completado
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-4">
            <div 
              className="bg-gradient-to-r from-blue-500 to-purple-600 h-4 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(progressPercentage, 100)}%` }}
            ></div>
          </div>
        </div>

        {/* Debts List */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100">
          <div className="p-6 border-b border-gray-100">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">Mis Deudas</h2>
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
                <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No tienes deudas registradas
                </h3>
                <p className="text-gray-500 mb-6">
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
                  <div key={debt.id} className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900">{debt.name}</h4>
                        <p className="text-sm text-gray-500 capitalize">{debt.category}</p>
                        <div className="mt-2 flex items-center space-x-4">
                          <span className="text-lg font-bold text-gray-900">
                            ${debt.currentAmount.toLocaleString()}
                          </span>
                          <span className="text-sm text-gray-500">
                            de ${debt.originalAmount.toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500">Pago mínimo</p>
                        <p className="font-semibold text-gray-900">
                          ${debt.minimumPayment.toLocaleString()}
                        </p>
                        <p className="text-sm text-gray-500">
                          {debt.interestRate}% interés
                        </p>
                      </div>
                    </div>
                    <div className="mt-3">
                      <div className="flex justify-between text-sm mb-1">
                        <span>Progreso</span>
                        <span>{((debt.originalAmount - debt.currentAmount) / debt.originalAmount * 100).toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
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
    </div>
  )
}