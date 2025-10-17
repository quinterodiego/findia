// Servicio mejorado de Google Sheets para Findia
import { GoogleSheetsConfig } from '@/types'

interface UserData {
  userId: string
  name: string
  email: string
  createdAt: string
  lastActiveAt: string
}

interface DebtData {
  id: string
  userId: string
  name: string
  amount: number
  currentAmount: number
  minimumPayment: number
  interestRate: number
  category: string
  createdAt: string
  updatedAt: string
}

interface PaymentData {
  id: string
  debtId: string
  userId: string
  amount: number
  paymentDate: string
  notes?: string
}

class FindiaGoogleSheetsService {
  private config: GoogleSheetsConfig
  private baseUrl = 'https://sheets.googleapis.com/v4/spreadsheets'

  constructor() {
    this.config = {
      spreadsheetId: import.meta.env.VITE_GOOGLE_SHEETS_ID || '',
      apiKey: import.meta.env.VITE_GOOGLE_API_KEY || '',
      range: 'Users!A1:Z1000'
    }
  }

  // Verificar si el servicio está configurado
  isConfigured(): boolean {
    return !!(this.config.spreadsheetId && this.config.apiKey)
  }

  // Validar configuración y devolver detalles
  private validateConfiguration(): { isValid: boolean; missingVars: string[] } {
    const missingVars: string[] = []
    
    if (!this.config.spreadsheetId) missingVars.push('VITE_GOOGLE_SHEETS_ID')
    if (!this.config.apiKey) missingVars.push('VITE_GOOGLE_API_KEY')
    
    return {
      isValid: missingVars.length === 0,
      missingVars
    }
  }

  // Probar conexión con Google Sheets
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const config = this.validateConfiguration()
      
      if (!config.isValid) {
        return {
          success: false,
          message: `Configuración incompleta: ${config.missingVars.join(', ')}`
        }
      }

      // Intentar leer la información básica de la hoja
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${this.config.spreadsheetId}?key=${this.config.apiKey}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          }
        }
      )

      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status} - ${response.statusText}`)
      }

      const data = await response.json()
      
      return {
        success: true,
        message: `✅ Conexión exitosa a "${data.properties?.title || 'Google Sheets'}"`
      }
    } catch (error) {
      return {
        success: false,
        message: `❌ Error de conexión: ${error instanceof Error ? error.message : 'Error desconocido'}`
      }
    }
  }

  // Construir URL de la API
  private buildApiUrl(range: string, spreadsheetId?: string): string {
    const sheetId = spreadsheetId || this.config.spreadsheetId
    return `${this.baseUrl}/${sheetId}/values/${range}?key=${this.config.apiKey}`
  }

  // Método genérico para leer datos
  private async readSheet(range: string): Promise<string[][]> {
    if (!this.isConfigured()) {
      console.warn('Google Sheets no configurado, usando datos de prueba')
      return []
    }

    try {
      const url = this.buildApiUrl(range)
      const response = await fetch(url)
      
      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`)
      }
      
      const data = await response.json()
      return data.values || []
    } catch (error) {
      console.error('Error leyendo Google Sheets:', error)
      return []
    }
  }

  // === USUARIOS ===
  async getUser(userId: string): Promise<UserData | null> {
    const rows = await this.readSheet('Users!A:F')
    
    // Buscar usuario (asumiendo que la primera fila son headers)
    const userRow = rows.slice(1).find(row => row[0] === userId)
    
    if (!userRow) return null
    
    return {
      userId: userRow[0],
      name: userRow[1],
      email: userRow[2],
      createdAt: userRow[3],
      lastActiveAt: userRow[4]
    }
  }

  async saveUser(userData: UserData): Promise<boolean> {
    // Por ahora, simulamos el guardado
    console.log('Guardando usuario:', userData)
    
    // En una implementación real, usarías OAuth para escribir
    // await this.appendToSheet('Users!A:F', [Object.values(userData)])
    
    return true
  }

  // === DEUDAS ===
  async getDebts(userId: string): Promise<DebtData[]> {
    const rows = await this.readSheet('Debts!A:J')
    
    // Filtrar deudas del usuario
    const debtRows = rows.slice(1).filter(row => row[1] === userId)
    
    return debtRows.map(row => ({
      id: row[0],
      userId: row[1],
      name: row[2],
      amount: parseFloat(row[3]) || 0,
      currentAmount: parseFloat(row[4]) || 0,
      minimumPayment: parseFloat(row[5]) || 0,
      interestRate: parseFloat(row[6]) || 0,
      category: row[7] || 'Otros',
      createdAt: row[8],
      updatedAt: row[9]
    }))
  }

  async saveDebt(debtData: DebtData): Promise<boolean> {
    console.log('Guardando deuda:', debtData)
    return true
  }

  async updateDebt(debtId: string, updates: Partial<DebtData>): Promise<boolean> {
    console.log('Actualizando deuda:', debtId, updates)
    return true
  }

  async deleteDebt(debtId: string): Promise<boolean> {
    console.log('Eliminando deuda:', debtId)
    return true
  }

  // === PAGOS ===
  async getPayments(userId: string): Promise<PaymentData[]> {
    const rows = await this.readSheet('Payments!A:F')
    
    // Filtrar pagos del usuario
    const paymentRows = rows.slice(1).filter(row => row[2] === userId)
    
    return paymentRows.map(row => ({
      id: row[0],
      debtId: row[1],
      userId: row[2],
      amount: parseFloat(row[3]) || 0,
      paymentDate: row[4],
      notes: row[5]
    }))
  }

  async savePayment(paymentData: PaymentData): Promise<boolean> {
    console.log('Guardando pago:', paymentData)
    return true
  }

  // === DATOS DE DEMO ===
  async getDemoData(userId: string): Promise<{
    debts: DebtData[]
    payments: PaymentData[]
    user: UserData
  }> {
    // Datos de demostración para cuando no hay Google Sheets configurado
    const demoUser: UserData = {
      userId,
      name: 'Usuario Demo',
      email: 'demo@findia.com',
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString()
    }

    const demoDebts: DebtData[] = [
      {
        id: 'debt-1',
        userId,
        name: 'Tarjeta de Crédito Visa',
        amount: 5000,
        currentAmount: 3200,
        minimumPayment: 150,
        interestRate: 18.5,
        category: 'Tarjetas de Crédito',
        createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'debt-2',
        userId,
        name: 'Préstamo Personal',
        amount: 12000,
        currentAmount: 8500,
        minimumPayment: 420,
        interestRate: 12.8,
        category: 'Préstamos',
        createdAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'debt-3',
        userId,
        name: 'Financiamiento Auto',
        amount: 25000,
        currentAmount: 18700,
        minimumPayment: 580,
        interestRate: 8.9,
        category: 'Vehículos',
        createdAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString()
      }
    ]

    const demoPayments: PaymentData[] = [
      {
        id: 'payment-1',
        debtId: 'debt-1',
        userId,
        amount: 300,
        paymentDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        notes: 'Pago extra del mes'
      },
      {
        id: 'payment-2',
        debtId: 'debt-2',
        userId,
        amount: 500,
        paymentDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        notes: 'Pago regular'
      }
    ]

    return {
      user: demoUser,
      debts: demoDebts,
      payments: demoPayments
    }
  }

  // === INICIALIZACIÓN ===
  async initializeUserSheets(userId: string): Promise<boolean> {
    // En una implementación completa, esto crearía las hojas necesarias
    console.log('Inicializando hojas para usuario:', userId)
    return true
  }
}

// Singleton instance
export const findiaSheets = new FindiaGoogleSheetsService()
export default findiaSheets