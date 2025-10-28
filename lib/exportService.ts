'use client'

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'

// Extender jsPDF para incluir autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: typeof autoTable
  }
}

export interface ExportData {
  incomes: any[]
  expenses: any[]
  debts: any[]
  goals: any[]
  stats: {
    totalIncomes: number
    totalExpenses: number
    netBalance: number
    goalsProgress: number
    completedGoals: number
    totalGoals: number
  }
}

export interface ExportOptions {
  dateRange?: {
    start: string
    end: string
  }
  includeCharts?: boolean
  includeStats?: boolean
  format: 'pdf' | 'excel'
}

class ExportService {
  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  private formatDate(date: string): string {
    return new Date(date).toLocaleDateString('es-CO')
  }

  private generateFileName(type: string, format: string): string {
    const now = new Date()
    const timestamp = now.toISOString().split('T')[0]
    return `FindIA_${type}_${timestamp}.${format}`
  }

  // Exportar a PDF
  async exportToPDF(data: ExportData, options: ExportOptions): Promise<void> {
    const doc = new jsPDF()
    
    // Configuración del documento
    doc.setProperties({
      title: 'Reporte Financiero FindIA',
      subject: 'Exportación de datos financieros',
      author: 'FindIA',
      creator: 'FindIA App'
    })

    let yPosition = 20

    // Header
    doc.setFontSize(20)
    doc.setFont('helvetica', 'bold')
    doc.text('Reporte Financiero FindIA', 20, yPosition)
    yPosition += 10

    doc.setFontSize(12)
    doc.setFont('helvetica', 'normal')
    doc.text(`Generado el: ${new Date().toLocaleDateString('es-CO')}`, 20, yPosition)
    yPosition += 20

    // Estadísticas generales
    if (options.includeStats) {
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.text('Resumen Financiero', 20, yPosition)
      yPosition += 15

      const statsData = [
        ['Ingresos Totales', this.formatCurrency(data.stats.totalIncomes)],
        ['Gastos Totales', this.formatCurrency(data.stats.totalExpenses)],
        ['Balance Neto', this.formatCurrency(data.stats.netBalance)],
        ['Progreso de Metas', `${data.stats.goalsProgress.toFixed(1)}%`],
        ['Metas Completadas', `${data.stats.completedGoals} de ${data.stats.totalGoals}`]
      ]

      autoTable(doc, {
        startY: yPosition,
        head: [['Métrica', 'Valor']],
        body: statsData,
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246] },
        styles: { fontSize: 10 },
        columnStyles: {
          1: { halign: 'right' }
        }
      })

      yPosition = (doc as any).lastAutoTable.finalY + 20
    }

    // Ingresos
    if (data.incomes.length > 0) {
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.text('Ingresos', 20, yPosition)
      yPosition += 15

      const incomeData = data.incomes.map(income => [
        income.name,
        income.category || 'Sin categoría',
        this.formatCurrency(income.amount),
        this.formatDate(income.date),
        income.notes || ''
      ])

      autoTable(doc, {
        startY: yPosition,
        head: [['Nombre', 'Categoría', 'Monto', 'Fecha', 'Notas']],
        body: incomeData,
        theme: 'grid',
        headStyles: { fillColor: [34, 197, 94] },
        styles: { fontSize: 9 },
        columnStyles: {
          2: { halign: 'right' }
        }
      })

      yPosition = (doc as any).lastAutoTable.finalY + 20
    }

    // Gastos
    if (data.expenses.length > 0) {
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.text('Gastos', 20, yPosition)
      yPosition += 15

      const expenseData = data.expenses.map(expense => [
        expense.name,
        expense.category || 'Sin categoría',
        this.formatCurrency(expense.amount),
        this.formatDate(expense.date),
        expense.expenseType || 'Variable',
        expense.notes || ''
      ])

      autoTable(doc, {
        startY: yPosition,
        head: [['Nombre', 'Categoría', 'Monto', 'Fecha', 'Tipo', 'Notas']],
        body: expenseData,
        theme: 'grid',
        headStyles: { fillColor: [239, 68, 68] },
        styles: { fontSize: 9 },
        columnStyles: {
          2: { halign: 'right' }
        }
      })

      yPosition = (doc as any).lastAutoTable.finalY + 20
    }

    // Deudas
    if (data.debts.length > 0) {
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.text('Deudas', 20, yPosition)
      yPosition += 15

      const debtData = data.debts.map(debt => [
        debt.name,
        debt.category || 'Sin categoría',
        this.formatCurrency(debt.amount),
        this.formatCurrency(debt.balance || 0),
        `${debt.interestRate || 0}%`,
        this.formatCurrency(debt.minPayment || 0),
        this.formatDate(debt.dueDate || ''),
        debt.priority || 'Media',
        debt.notes || ''
      ])

      autoTable(doc, {
        startY: yPosition,
        head: [['Nombre', 'Categoría', 'Monto Original', 'Saldo Actual', 'Interés', 'Pago Mínimo', 'Vencimiento', 'Prioridad', 'Notas']],
        body: debtData,
        theme: 'grid',
        headStyles: { fillColor: [168, 85, 247] },
        styles: { fontSize: 8 },
        columnStyles: {
          2: { halign: 'right' },
          3: { halign: 'right' },
          5: { halign: 'right' }
        }
      })

      yPosition = (doc as any).lastAutoTable.finalY + 20
    }

    // Metas
    if (data.goals.length > 0) {
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.text('Metas de Ahorro', 20, yPosition)
      yPosition += 15

      const goalData = data.goals.map(goal => [
        goal.name,
        goal.category || 'Sin categoría',
        this.formatCurrency(goal.amount),
        this.formatCurrency(goal.currentAmount || 0),
        this.formatDate(goal.targetDate || ''),
        `${((goal.currentAmount || 0) / goal.amount * 100).toFixed(1)}%`,
        goal.notes || ''
      ])

      autoTable(doc, {
        startY: yPosition,
        head: [['Nombre', 'Categoría', 'Meta', 'Actual', 'Fecha Objetivo', 'Progreso', 'Notas']],
        body: goalData,
        theme: 'grid',
        headStyles: { fillColor: [245, 158, 11] },
        styles: { fontSize: 9 },
        columnStyles: {
          2: { halign: 'right' },
          3: { halign: 'right' },
          5: { halign: 'right' }
        }
      })
    }

    // Footer
    const pageCount = doc.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.text(`Página ${i} de ${pageCount}`, 20, doc.internal.pageSize.height - 10)
      doc.text('Generado por FindIA', doc.internal.pageSize.width - 50, doc.internal.pageSize.height - 10)
    }

    // Guardar archivo
    const fileName = this.generateFileName('Reporte', 'pdf')
    doc.save(fileName)
  }

  // Exportar a Excel
  async exportToExcel(data: ExportData, options: ExportOptions): Promise<void> {
    const workbook = XLSX.utils.book_new()

    // Hoja de estadísticas
    if (options.includeStats) {
      const statsData = [
        ['Métrica', 'Valor'],
        ['Ingresos Totales', data.stats.totalIncomes],
        ['Gastos Totales', data.stats.totalExpenses],
        ['Balance Neto', data.stats.netBalance],
        ['Progreso de Metas (%)', data.stats.goalsProgress],
        ['Metas Completadas', data.stats.completedGoals],
        ['Total de Metas', data.stats.totalGoals]
      ]

      const statsSheet = XLSX.utils.aoa_to_sheet(statsData)
      
      // Formatear la columna de valores como moneda
      const range = XLSX.utils.decode_range(statsSheet['!ref']!)
      for (let row = 1; row <= range.e.r; row++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: 1 })
        if (statsSheet[cellAddress]) {
          statsSheet[cellAddress].z = '"$"#,##0'
        }
      }

      XLSX.utils.book_append_sheet(workbook, statsSheet, 'Resumen')
    }

    // Hoja de ingresos
    if (data.incomes.length > 0) {
      const incomeData = [
        ['Nombre', 'Categoría', 'Monto', 'Fecha', 'Tipo', 'Recurrente', 'Frecuencia', 'Notas'],
        ...data.incomes.map(income => [
          income.name,
          income.category || 'Sin categoría',
          income.amount,
          income.date,
          'Ingreso',
          income.isRecurring ? 'Sí' : 'No',
          income.frequency || 'Mensual',
          income.notes || ''
        ])
      ]

      const incomeSheet = XLSX.utils.aoa_to_sheet(incomeData)
      
      // Formatear columna de monto como moneda
      const range = XLSX.utils.decode_range(incomeSheet['!ref']!)
      for (let row = 1; row <= range.e.r; row++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: 2 })
        if (incomeSheet[cellAddress]) {
          incomeSheet[cellAddress].z = '"$"#,##0'
        }
      }

      XLSX.utils.book_append_sheet(workbook, incomeSheet, 'Ingresos')
    }

    // Hoja de gastos
    if (data.expenses.length > 0) {
      const expenseData = [
        ['Nombre', 'Categoría', 'Monto', 'Fecha', 'Tipo', 'Recurrente', 'Frecuencia', 'Notas'],
        ...data.expenses.map(expense => [
          expense.name,
          expense.category || 'Sin categoría',
          expense.amount,
          expense.date,
          expense.expenseType || 'Variable',
          expense.isRecurring ? 'Sí' : 'No',
          expense.frequency || 'Mensual',
          expense.notes || ''
        ])
      ]

      const expenseSheet = XLSX.utils.aoa_to_sheet(expenseData)
      
      // Formatear columna de monto como moneda
      const range = XLSX.utils.decode_range(expenseSheet['!ref']!)
      for (let row = 1; row <= range.e.r; row++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: 2 })
        if (expenseSheet[cellAddress]) {
          expenseSheet[cellAddress].z = '"$"#,##0'
        }
      }

      XLSX.utils.book_append_sheet(workbook, expenseSheet, 'Gastos')
    }

    // Hoja de deudas
    if (data.debts.length > 0) {
      const debtData = [
        ['Nombre', 'Categoría', 'Monto Original', 'Saldo Actual', 'Tasa de Interés (%)', 'Pago Mínimo', 'Fecha de Vencimiento', 'Prioridad', 'Notas'],
        ...data.debts.map(debt => [
          debt.name,
          debt.category || 'Sin categoría',
          debt.amount,
          debt.balance || 0,
          debt.interestRate || 0,
          debt.minPayment || 0,
          debt.dueDate || '',
          debt.priority || 'Media',
          debt.notes || ''
        ])
      ]

      const debtSheet = XLSX.utils.aoa_to_sheet(debtData)
      
      // Formatear columnas de montos como moneda
      const range = XLSX.utils.decode_range(debtSheet['!ref']!)
      for (let row = 1; row <= range.e.r; row++) {
        const cellAddresses = [
          XLSX.utils.encode_cell({ r: row, c: 2 }), // Monto Original
          XLSX.utils.encode_cell({ r: row, c: 3 }), // Saldo Actual
          XLSX.utils.encode_cell({ r: row, c: 5 })  // Pago Mínimo
        ]
        
        cellAddresses.forEach(address => {
          if (debtSheet[address]) {
            debtSheet[address].z = '"$"#,##0'
          }
        })
      }

      XLSX.utils.book_append_sheet(workbook, debtSheet, 'Deudas')
    }

    // Hoja de metas
    if (data.goals.length > 0) {
      const goalData = [
        ['Nombre', 'Categoría', 'Meta de Ahorro', 'Monto Actual', 'Fecha Objetivo', 'Progreso (%)', 'Notas'],
        ...data.goals.map(goal => [
          goal.name,
          goal.category || 'Sin categoría',
          goal.amount,
          goal.currentAmount || 0,
          goal.targetDate || '',
          ((goal.currentAmount || 0) / goal.amount * 100).toFixed(1),
          goal.notes || ''
        ])
      ]

      const goalSheet = XLSX.utils.aoa_to_sheet(goalData)
      
      // Formatear columnas de montos como moneda
      const range = XLSX.utils.decode_range(goalSheet['!ref']!)
      for (let row = 1; row <= range.e.r; row++) {
        const cellAddresses = [
          XLSX.utils.encode_cell({ r: row, c: 2 }), // Meta de Ahorro
          XLSX.utils.encode_cell({ r: row, c: 3 })  // Monto Actual
        ]
        
        cellAddresses.forEach(address => {
          if (goalSheet[address]) {
            goalSheet[address].z = '"$"#,##0'
          }
        })
      }

      XLSX.utils.book_append_sheet(workbook, goalSheet, 'Metas')
    }

    // Guardar archivo
    const fileName = this.generateFileName('Reporte', 'xlsx')
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    saveAs(blob, fileName)
  }

  // Método principal de exportación
  async export(data: ExportData, options: ExportOptions): Promise<void> {
    try {
      if (options.format === 'pdf') {
        await this.exportToPDF(data, options)
      } else if (options.format === 'excel') {
        await this.exportToExcel(data, options)
      }
    } catch (error) {
      console.error('Error al exportar:', error)
      throw new Error('Error al generar el archivo de exportación')
    }
  }
}

export const exportService = new ExportService()
