import { google } from 'googleapis'
import { Debt, Payment, User } from '@/types'

class GoogleSheetsService {
  private sheets: import('googleapis').sheets_v4.Sheets
  private spreadsheetId: string

  constructor() {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    })

    this.sheets = google.sheets({ version: 'v4', auth })
    this.spreadsheetId = process.env.GOOGLE_SHEETS_ID!
  }

  async initializeSheetStructure() {
    try {
      // Check if sheets exist, if not create them
      const spreadsheet = await this.sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
      })

      const existingSheets = spreadsheet.data.sheets?.map((sheet) => sheet.properties?.title) || []
      const requiredSheets = ['Users', 'Debts', 'Payments']

      for (const sheetName of requiredSheets) {
        if (!existingSheets.includes(sheetName)) {
          await this.createSheet(sheetName)
        }
      }

      // Initialize headers if needed
      await this.initializeHeaders()
    } catch (error) {
      console.error('Error initializing sheet structure:', error)
      throw error
    }
  }

  private async createSheet(title: string) {
    await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId: this.spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title,
              },
            },
          },
        ],
      },
    })
  }

  private async initializeHeaders() {
    const headers = {
      Users: ['ID', 'Email', 'Name', 'Picture', 'Provider', 'Created At', 'Is Admin'],
      Debts: ['ID', 'User ID', 'Name', 'Current Amount', 'Original Amount', 'Minimum Payment', 'Interest Rate', 'Due Date', 'Priority', 'Category', 'Notes', 'Created At', 'Updated At'],
      Payments: ['ID', 'Debt ID', 'User ID', 'Amount', 'Date', 'Notes'],
    }

    for (const [sheetName, headerRow] of Object.entries(headers)) {
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A1:${String.fromCharCode(64 + headerRow.length)}1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [headerRow],
        },
      })
    }
  }

  async getUser(email: string): Promise<User | null> {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'Users!A:G',
      })

      const rows = response.data.values || []
      const userRow = rows.find((row: string[]) => row[1] === email)
      
      if (!userRow) return null

      return {
        id: userRow[0],
        email: userRow[1],
        name: userRow[2],
        picture: userRow[3],
        provider: userRow[4] as 'google' | 'email',
        createdAt: userRow[5],
        isAdmin: userRow[6] === 'TRUE',
      }
    } catch (error) {
      console.error('Error getting user:', error)
      return null
    }
  }

  async createUser(user: Omit<User, 'id'>): Promise<User> {
    const id = `user_${Date.now()}`
    const newUser: User = { ...user, id }

    await this.sheets.spreadsheets.values.append({
      spreadsheetId: this.spreadsheetId,
      range: 'Users!A:G',
      valueInputOption: 'RAW',
      requestBody: {
        values: [[
          newUser.id,
          newUser.email,
          newUser.name,
          newUser.picture || '',
          newUser.provider,
          newUser.createdAt,
          newUser.isAdmin ? 'TRUE' : 'FALSE',
        ]],
      },
    })

    return newUser
  }

  async getUserDebts(userId: string): Promise<Debt[]> {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'Debts!A:M',
      })

      const rows = response.data.values || []
      const userDebts = rows.filter((row: string[]) => row[1] === userId)

      return userDebts.map((row: string[]) => ({
        id: row[0],
        userId: row[1],
        name: row[2],
        currentAmount: parseFloat(row[3]) || 0,
        originalAmount: parseFloat(row[4]) || 0,
        minimumPayment: parseFloat(row[5]) || 0,
        interestRate: parseFloat(row[6]) || 0,
        dueDate: row[7],
        priority: row[8] as 'high' | 'medium' | 'low',
        category: row[9],
        notes: row[10] || '',
        createdAt: row[11],
        updatedAt: row[12],
      }))
    } catch (error) {
      console.error('Error getting user debts:', error)
      return []
    }
  }

  async createDebt(debt: Omit<Debt, 'id'>): Promise<Debt> {
    const id = `debt_${Date.now()}`
    const newDebt: Debt = { ...debt, id }

    await this.sheets.spreadsheets.values.append({
      spreadsheetId: this.spreadsheetId,
      range: 'Debts!A:M',
      valueInputOption: 'RAW',
      requestBody: {
        values: [[
          newDebt.id,
          newDebt.userId,
          newDebt.name,
          newDebt.currentAmount,
          newDebt.originalAmount,
          newDebt.minimumPayment,
          newDebt.interestRate,
          newDebt.dueDate,
          newDebt.priority,
          newDebt.category,
          newDebt.notes || '',
          newDebt.createdAt,
          newDebt.updatedAt,
        ]],
      },
    })

    return newDebt
  }

  async updateDebt(debt: Debt): Promise<void> {
    // Find the row index for this debt
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: 'Debts!A:A',
    })

    const rows = response.data.values || []
    const rowIndex = rows.findIndex((row: string[]) => row[0] === debt.id)

    if (rowIndex === -1) {
      throw new Error('Debt not found')
    }

    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `Debts!A${rowIndex + 1}:M${rowIndex + 1}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[
          debt.id,
          debt.userId,
          debt.name,
          debt.currentAmount,
          debt.originalAmount,
          debt.minimumPayment,
          debt.interestRate,
          debt.dueDate,
          debt.priority,
          debt.category,
          debt.notes || '',
          debt.createdAt,
          debt.updatedAt,
        ]],
      },
    })
  }

  async createPayment(payment: Omit<Payment, 'id'>): Promise<Payment> {
    const id = `payment_${Date.now()}`
    const newPayment: Payment = { ...payment, id }

    await this.sheets.spreadsheets.values.append({
      spreadsheetId: this.spreadsheetId,
      range: 'Payments!A:F',
      valueInputOption: 'RAW',
      requestBody: {
        values: [[
          newPayment.id,
          newPayment.debtId,
          newPayment.userId,
          newPayment.amount,
          newPayment.date,
          newPayment.notes || '',
        ]],
      },
    })

    return newPayment
  }

  async getPayments(userId: string): Promise<Payment[]> {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'Payments!A:F',
      })

      const rows = response.data.values || []
      const userPayments = rows.filter((row: string[]) => row[2] === userId)

      return userPayments.map((row: string[]) => ({
        id: row[0],
        debtId: row[1],
        userId: row[2],
        amount: parseFloat(row[3]) || 0,
        date: row[4],
        notes: row[5] || '',
      }))
    } catch (error) {
      console.error('Error getting payments:', error)
      return []
    }
  }
}

export const googleSheetsService = new GoogleSheetsService()