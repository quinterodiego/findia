import { GoogleSheetsConfig, SheetData, Debt, Payment } from '@/types'

// Configuración de Google Sheets
const GOOGLE_SHEETS_CONFIG: GoogleSheetsConfig = {
  spreadsheetId: '', // Se configurará con variables de entorno
  apiKey: '', // Se configurará con variables de entorno
  range: 'FindIA_Data!A1:Z1000'
}

class GoogleSheetsService {
  private config: GoogleSheetsConfig

  constructor(config: GoogleSheetsConfig = GOOGLE_SHEETS_CONFIG) {
    this.config = config
  }

  // Construir URL de la API de Google Sheets
  private buildApiUrl(range: string): string {
    const { spreadsheetId, apiKey } = this.config
    return `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?key=${apiKey}`
  }

  // Obtener datos de una hoja
  async getData(range?: string): Promise<SheetData | null> {
    try {
      const targetRange = range || this.config.range
      const url = this.buildApiUrl(targetRange)
      
      const response = await fetch(url)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      return data
    } catch (error) {
      console.error('Error fetching data from Google Sheets:', error)
      return null
    }
  }

  // Guardar datos en Google Sheets (requiere autenticación OAuth)
  async saveData(range: string, values: string[][]): Promise<boolean> {
    try {
      // Nota: Para escribir datos necesitamos OAuth 2.0, no solo API Key
      // Esta es una implementación básica que requiere configuración adicional
      
      const { spreadsheetId } = this.config
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=RAW`
      
      const requestBody = {
        values: values,
        majorDimension: 'ROWS'
      }

      // Aquí necesitarías el token de autenticación OAuth
      const authToken = await this.getAuthToken()
      
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })

      return response.ok
    } catch (error) {
      console.error('Error saving data to Google Sheets:', error)
      return false
    }
  }

  // Obtener token de autenticación (implementación simplificada)
  private async getAuthToken(): Promise<string> {
    // En una implementación real, aquí manejarías OAuth 2.0
    // Por ahora retornamos un string vacío y usamos localStorage como fallback
    return localStorage.getItem('google_auth_token') || ''
  }

  // Convertir datos de deudas a formato de hoja
  private debtsToSheetFormat(debts: Debt[]): string[][] {
    const header = ['ID', 'Nombre', 'Monto Total', 'Monto Pagado', 'Tasa de Interés', 'Fecha Límite', 'Creado', 'Actualizado']
    const rows = debts.map(debt => [
      debt.id,
      debt.name,
      debt.amount.toString(),
      debt.paid.toString(),
      debt.interestRate?.toString() || '',
      debt.dueDate || '',
      debt.createdAt,
      debt.updatedAt
    ])
    
    return [header, ...rows]
  }

  // Convertir datos de pagos a formato de hoja
  private paymentsToSheetFormat(payments: Payment[]): string[][] {
    const header = ['ID', 'ID Deuda', 'Monto', 'Fecha', 'Descripción', 'Tipo']
    const rows = payments.map(payment => [
      payment.id,
      payment.debtId || '',
      payment.amount.toString(),
      payment.date,
      payment.description || '',
      payment.type
    ])
    
    return [header, ...rows]
  }

  // Convertir formato de hoja a datos de deudas
  private sheetFormatToDebts(sheetData: SheetData): Debt[] {
    if (!sheetData.values || sheetData.values.length < 2) return []
    
    const [, ...rows] = sheetData.values
    
    return rows.map((row, index) => ({
      id: row[0] || `debt_${index}`,
      name: row[1] || 'Deuda sin nombre',
      amount: parseFloat(row[2]) || 0,
      paid: parseFloat(row[3]) || 0,
      interestRate: row[4] ? parseFloat(row[4]) : undefined,
      dueDate: row[5] || undefined,
      createdAt: row[6] || new Date().toISOString(),
      updatedAt: row[7] || new Date().toISOString()
    }))
  }

  // Métodos públicos para la aplicación
  async loadDebts(): Promise<Debt[]> {
    try {
      const data = await this.getData('Deudas!A1:H1000')
      return data ? this.sheetFormatToDebts(data) : []
    } catch (error) {
      console.error('Error loading debts:', error)
      return []
    }
  }

  async saveDebts(debts: Debt[]): Promise<boolean> {
    try {
      const sheetData = this.debtsToSheetFormat(debts)
      return await this.saveData('Deudas!A1:H1000', sheetData)
    } catch (error) {
      console.error('Error saving debts:', error)
      return false
    }
  }

  async loadPayments(): Promise<Payment[]> {
    try {
      const data = await this.getData('Pagos!A1:F1000')
      if (!data?.values || data.values.length < 2) return []
      
      const [, ...rows] = data.values
      
      return rows.map((row, index) => ({
        id: row[0] || `payment_${index}`,
        debtId: row[1] || undefined,
        amount: parseFloat(row[2]) || 0,
        date: row[3] || new Date().toISOString(),
        description: row[4] || undefined,
        type: (row[5] as Payment['type']) || 'payment'
      }))
    } catch (error) {
      console.error('Error loading payments:', error)
      return []
    }
  }

  async savePayments(payments: Payment[]): Promise<boolean> {
    try {
      const sheetData = this.paymentsToSheetFormat(payments)
      return await this.saveData('Pagos!A1:F1000', sheetData)
    } catch (error) {
      console.error('Error saving payments:', error)
      return false
    }
  }

  // Método para verificar la conectividad
  async testConnection(): Promise<boolean> {
    try {
      const data = await this.getData('A1:A1')
      return data !== null
    } catch (error) {
      console.error('Connection test failed:', error)
      return false
    }
  }

  // Crear estructura inicial de hojas si no existe
  async initializeSheets(): Promise<boolean> {
    try {
      // Crear headers para deudas
      const debtsHeader = [['ID', 'Nombre', 'Monto Total', 'Monto Pagado', 'Tasa de Interés', 'Fecha Límite', 'Creado', 'Actualizado']]
      const debtsResult = await this.saveData('Deudas!A1:H1', debtsHeader)
      
      // Crear headers para pagos
      const paymentsHeader = [['ID', 'ID Deuda', 'Monto', 'Fecha', 'Descripción', 'Tipo']]
      const paymentsResult = await this.saveData('Pagos!A1:F1', paymentsHeader)
      
      return debtsResult && paymentsResult
    } catch (error) {
      console.error('Error initializing sheets:', error)
      return false
    }
  }
}

// Hook personalizado para usar Google Sheets
export const useGoogleSheets = () => {
  const sheetsService = new GoogleSheetsService()

  return {
    loadDebts: () => sheetsService.loadDebts(),
    saveDebts: (debts: Debt[]) => sheetsService.saveDebts(debts),
    loadPayments: () => sheetsService.loadPayments(),
    savePayments: (payments: Payment[]) => sheetsService.savePayments(payments),
    testConnection: () => sheetsService.testConnection(),
    initializeSheets: () => sheetsService.initializeSheets()
  }
}

// Servicio de sincronización local/remoto
export class SyncService {
  private sheetsService: GoogleSheetsService

  constructor() {
    this.sheetsService = new GoogleSheetsService()
  }

  // Sincronizar datos con Google Sheets
  async syncData(): Promise<{ success: boolean, message: string }> {
    try {
      // Verificar conectividad
      const isConnected = await this.sheetsService.testConnection()
      if (!isConnected) {
        return { 
          success: false, 
          message: 'No se pudo conectar con Google Sheets. Los datos se guardarán localmente.' 
        }
      }

      // Cargar datos locales
      const localDebts = JSON.parse(localStorage.getItem('findia_debts') || '[]')
      const localPayments = JSON.parse(localStorage.getItem('findia_payments') || '[]')

      // Intentar guardar en Google Sheets
      const debtsSync = await this.sheetsService.saveDebts(localDebts)
      const paymentsSync = await this.sheetsService.savePayments(localPayments)

      if (debtsSync && paymentsSync) {
        // Marcar como sincronizado
        localStorage.setItem('findia_last_sync', new Date().toISOString())
        return { 
          success: true, 
          message: 'Datos sincronizados correctamente con Google Sheets' 
        }
      } else {
        return { 
          success: false, 
          message: 'Error parcial en la sincronización. Algunos datos no se guardaron.' 
        }
      }
    } catch (error) {
      console.error('Sync error:', error)
      return { 
        success: false, 
        message: 'Error de sincronización. Los datos se mantienen localmente.' 
      }
    }
  }

  // Obtener estado de sincronización
  getSyncStatus(): { lastSync: string | null, needsSync: boolean } {
    const lastSync = localStorage.getItem('findia_last_sync')
    const lastModification = localStorage.getItem('findia_last_modification')
    
    const needsSync = lastModification && (!lastSync || new Date(lastModification) > new Date(lastSync))
    
    return {
      lastSync,
      needsSync: Boolean(needsSync)
    }
  }
}

export default GoogleSheetsService