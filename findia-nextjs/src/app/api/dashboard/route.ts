import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/route'
import { googleSheetsService } from '@/lib/google-sheets'
import type { DebtStats } from '@/types'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user
    const user = await googleSheetsService.getUser(session.user.email)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const [debts, payments] = await Promise.all([
      googleSheetsService.getUserDebts(user.id),
      googleSheetsService.getPayments(user.id)
    ])

    // Calculate statistics
    const totalOriginalDebt = debts.reduce((sum, debt) => sum + debt.originalAmount, 0)
    const totalCurrentDebt = debts.reduce((sum, debt) => sum + debt.currentAmount, 0)
    const totalPaid = totalOriginalDebt - totalCurrentDebt
    const progressPercentage = totalOriginalDebt > 0 ? (totalPaid / totalOriginalDebt) * 100 : 0
    const monthlyPayment = debts.reduce((sum, debt) => sum + debt.minimumPayment, 0)
    
    // Calculate estimated payoff date (simplified calculation)
    const estimatedMonths = totalCurrentDebt > 0 && monthlyPayment > 0 
      ? Math.ceil(totalCurrentDebt / monthlyPayment) 
      : 0
    const estimatedPayoffDate = new Date()
    estimatedPayoffDate.setMonth(estimatedPayoffDate.getMonth() + estimatedMonths)

    const stats: DebtStats = {
      totalDebt: totalCurrentDebt,
      totalPaid,
      progressPercentage,
      monthlyPayment,
      estimatedPayoffDate: estimatedPayoffDate.toISOString().split('T')[0],
      totalDebts: debts.length,
    }

    return NextResponse.json({
      stats,
      debts,
      payments,
      recentPayments: payments
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 5)
    })
  } catch (error) {
    console.error('Error fetching dashboard data:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}