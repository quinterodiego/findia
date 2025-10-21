import { google } from 'googleapis';
import type { Debt, Payment } from '@/types';

// Configuración de autenticación con Service Account
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });
const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID;

// Nombres de las hojas en Google Sheets
const SHEETS = {
  DEBTS: 'Debts',
  PAYMENTS: 'Payments',
  USERS: 'Users',
} as const;

// ============================================================================
// INICIALIZACIÓN DE HOJAS
// ============================================================================

/**
 * Verifica si una hoja existe en el spreadsheet
 */
async function sheetExists(sheetName: string): Promise<boolean> {
  try {
    const response = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });
    
    const sheetExists = response.data.sheets?.some(
      sheet => sheet.properties?.title === sheetName
    );
    
    return sheetExists || false;
  } catch (error) {
    console.error(`Error verificando hoja ${sheetName}:`, error);
    return false;
  }
}

/**
 * Crea una hoja con encabezados si no existe
 */
async function createSheetIfNotExists(sheetName: string, headers: string[]) {
  const exists = await sheetExists(sheetName);
  
  if (!exists) {
    // Crear la hoja
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: sheetName,
              },
            },
          },
        ],
      },
    });
    
    // Agregar encabezados
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A1`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [headers],
      },
    });
    
    console.log(`Hoja ${sheetName} creada con encabezados`);
  }
}

/**
 * Inicializa todas las hojas necesarias
 */
export async function initializeSheets() {
  try {
    // Crear hoja de Debts
    await createSheetIfNotExists(SHEETS.DEBTS, [
      'id',
      'userId',
      'name',
      'amount',
      'balance',
      'interestRate',
      'minPayment',
      'dueDate',
      'priority',
      'status',
      'category',
      'notes',
      'createdAt',
      'updatedAt',
    ]);
    
    // Crear hoja de Payments
    await createSheetIfNotExists(SHEETS.PAYMENTS, [
      'id',
      'debtId',
      'userId',
      'amount',
      'date',
      'type',
      'notes',
      'createdAt',
    ]);
    
    // Crear hoja de Users
    await createSheetIfNotExists(SHEETS.USERS, [
      'id',
      'email',
      'name',
      'image',
      'createdAt',
      'lastLogin',
    ]);
    
    console.log('✅ Todas las hojas inicializadas correctamente');
    return { success: true };
  } catch (error) {
    console.error('❌ Error inicializando hojas:', error);
    throw error;
  }
}

// ============================================================================
// FUNCIONES AUXILIARES
// ============================================================================

/**
 * Genera un ID único
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Convierte una fila de Google Sheets a objeto Debt
 */
function rowToDebt(row: string[]): Debt {
  return {
    id: row[0],
    userId: row[1],
    name: row[2],
    amount: parseFloat(row[3] || '0'),
    balance: parseFloat(row[4] || '0'),
    interestRate: parseFloat(row[5] || '0'),
    minPayment: parseFloat(row[6] || '0'),
    dueDate: row[7],
    priority: (row[8] as 'high' | 'medium' | 'low') || 'medium',
    status: (row[9] as 'active' | 'paid' | 'overdue') || 'active',
    category: row[10] || 'other',
    notes: row[11] || '',
    createdAt: row[12],
    updatedAt: row[13],
  };
}

/**
 * Convierte un objeto Debt a fila de Google Sheets
 */
function debtToRow(debt: Debt): (string | number)[] {
  return [
    debt.id,
    debt.userId,
    debt.name,
    debt.amount,
    debt.balance,
    debt.interestRate,
    debt.minPayment,
    debt.dueDate,
    debt.priority,
    debt.status,
    debt.category,
    debt.notes,
    debt.createdAt,
    debt.updatedAt,
  ];
}

/**
 * Convierte una fila de Google Sheets a objeto Payment
 */
function rowToPayment(row: string[]): Payment {
  return {
    id: row[0],
    debtId: row[1],
    userId: row[2],
    amount: parseFloat(row[3] || '0'),
    date: row[4],
    type: (row[5] as 'regular' | 'extra' | 'minimum') || 'regular',
    notes: row[6] || '',
    createdAt: row[7],
  };
}

/**
 * Convierte un objeto Payment a fila de Google Sheets
 */
function paymentToRow(payment: Payment): (string | number)[] {
  return [
    payment.id,
    payment.debtId,
    payment.userId,
    payment.amount,
    payment.date,
    payment.type,
    payment.notes,
    payment.createdAt,
  ];
}

// ============================================================================
// OPERACIONES CRUD - DEBTS
// ============================================================================

/**
 * Obtiene todas las deudas de un usuario
 */
export async function getDebtsByUser(userId: string): Promise<Debt[]> {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.DEBTS}!A2:N`,
    });
    
    const rows = response.data.values || [];
    const debts = rows
      .filter(row => row[1] === userId) // Filtrar por userId
      .map(rowToDebt);
    
    return debts;
  } catch (error) {
    console.error('Error obteniendo deudas:', error);
    throw error;
  }
}

/**
 * Obtiene una deuda por ID
 */
export async function getDebtById(debtId: string, userId: string): Promise<Debt | null> {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.DEBTS}!A2:N`,
    });
    
    const rows = response.data.values || [];
    const debtRow = rows.find(row => row[0] === debtId && row[1] === userId);
    
    if (!debtRow) return null;
    
    return rowToDebt(debtRow);
  } catch (error) {
    console.error('Error obteniendo deuda:', error);
    throw error;
  }
}

/**
 * Crea una nueva deuda
 */
export async function createDebt(
  userId: string,
  debtData: Omit<Debt, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
): Promise<Debt> {
  try {
    const now = new Date().toISOString();
    const newDebt: Debt = {
      id: generateId(),
      userId,
      ...debtData,
      createdAt: now,
      updatedAt: now,
    };
    
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.DEBTS}!A2`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [debtToRow(newDebt)],
      },
    });
    
    console.log('✅ Deuda creada:', newDebt.id);
    return newDebt;
  } catch (error) {
    console.error('Error creando deuda:', error);
    throw error;
  }
}

/**
 * Actualiza una deuda existente
 */
export async function updateDebt(
  debtId: string,
  userId: string,
  updates: Partial<Debt>
): Promise<Debt> {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.DEBTS}!A2:N`,
    });
    
    const rows = response.data.values || [];
    const rowIndex = rows.findIndex(row => row[0] === debtId && row[1] === userId);
    
    if (rowIndex === -1) {
      throw new Error('Deuda no encontrada');
    }
    
    const currentDebt = rowToDebt(rows[rowIndex]);
    const updatedDebt: Debt = {
      ...currentDebt,
      ...updates,
      id: debtId,
      userId,
      updatedAt: new Date().toISOString(),
    };
    
    const actualRowNumber = rowIndex + 2; // +2 porque Google Sheets es 1-indexed y hay header
    
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.DEBTS}!A${actualRowNumber}:N${actualRowNumber}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [debtToRow(updatedDebt)],
      },
    });
    
    console.log('✅ Deuda actualizada:', debtId);
    return updatedDebt;
  } catch (error) {
    console.error('Error actualizando deuda:', error);
    throw error;
  }
}

/**
 * Elimina una deuda
 */
export async function deleteDebt(debtId: string, userId: string): Promise<void> {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.DEBTS}!A2:N`,
    });
    
    const rows = response.data.values || [];
    const rowIndex = rows.findIndex(row => row[0] === debtId && row[1] === userId);
    
    if (rowIndex === -1) {
      throw new Error('Deuda no encontrada');
    }
    
    // Obtener información de la hoja
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });
    
    const sheet = spreadsheet.data.sheets?.find(
      s => s.properties?.title === SHEETS.DEBTS
    );
    
    if (!sheet || !sheet.properties?.sheetId) {
      throw new Error('Hoja no encontrada');
    }
    
    const actualRowNumber = rowIndex + 1; // +1 porque header es row 0
    
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: sheet.properties.sheetId,
                dimension: 'ROWS',
                startIndex: actualRowNumber,
                endIndex: actualRowNumber + 1,
              },
            },
          },
        ],
      },
    });
    
    console.log('✅ Deuda eliminada:', debtId);
  } catch (error) {
    console.error('Error eliminando deuda:', error);
    throw error;
  }
}

// ============================================================================
// OPERACIONES CRUD - PAYMENTS
// ============================================================================

/**
 * Obtiene todos los pagos de una deuda
 */
export async function getPaymentsByDebt(debtId: string): Promise<Payment[]> {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.PAYMENTS}!A2:H`,
    });
    
    const rows = response.data.values || [];
    const payments = rows
      .filter(row => row[1] === debtId)
      .map(rowToPayment);
    
    return payments;
  } catch (error) {
    console.error('Error obteniendo pagos:', error);
    throw error;
  }
}

/**
 * Crea un nuevo pago y actualiza el balance de la deuda
 */
export async function createPayment(
  userId: string,
  debtId: string,
  paymentData: Omit<Payment, 'id' | 'userId' | 'debtId' | 'createdAt'>
): Promise<Payment> {
  try {
    const now = new Date().toISOString();
    const newPayment: Payment = {
      id: generateId(),
      debtId,
      userId,
      ...paymentData,
      createdAt: now,
    };
    
    // Agregar el pago
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.PAYMENTS}!A2`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [paymentToRow(newPayment)],
      },
    });
    
    // Actualizar el balance de la deuda
    const debt = await getDebtById(debtId, userId);
    if (debt) {
      const newBalance = debt.balance - paymentData.amount;
      const newStatus: 'active' | 'paid' | 'overdue' = newBalance <= 0 ? 'paid' : debt.status;
      
      await updateDebt(debtId, userId, {
        balance: Math.max(0, newBalance),
        status: newStatus,
      });
    }
    
    console.log('✅ Pago registrado:', newPayment.id);
    return newPayment;
  } catch (error) {
    console.error('Error creando pago:', error);
    throw error;
  }
}

/**
 * Obtiene todos los pagos de un usuario
 */
export async function getPaymentsByUser(userId: string): Promise<Payment[]> {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.PAYMENTS}!A2:H`,
    });
    
    const rows = response.data.values || [];
    const payments = rows
      .filter(row => row[2] === userId)
      .map(rowToPayment);
    
    return payments;
  } catch (error) {
    console.error('Error obteniendo pagos del usuario:', error);
    throw error;
  }
}

// ============================================================================
// ESTADÍSTICAS Y CÁLCULOS
// ============================================================================

/**
 * Calcula estadísticas de deudas de un usuario
 */
export async function getDebtStats(userId: string) {
  try {
    const debts = await getDebtsByUser(userId);
    const payments = await getPaymentsByUser(userId);
    
    const totalDebt = debts.reduce((sum, debt) => sum + debt.amount, 0);
    const totalBalance = debts.reduce((sum, debt) => sum + debt.balance, 0);
    const totalPaid = totalDebt - totalBalance;
    const progress = totalDebt > 0 ? (totalPaid / totalDebt) * 100 : 0;
    
    const activeDebts = debts.filter(d => d.status === 'active').length;
    const paidDebts = debts.filter(d => d.status === 'paid').length;
    const overdueDebts = debts.filter(d => d.status === 'overdue').length;
    
    // Calcular pago mensual mínimo
    const monthlyMinPayment = debts
      .filter(d => d.status === 'active')
      .reduce((sum, debt) => sum + debt.minPayment, 0);
    
    // Pagos del mes actual
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    const paymentsThisMonth = payments.filter(payment => {
      const paymentDate = new Date(payment.date);
      return (
        paymentDate.getMonth() === currentMonth &&
        paymentDate.getFullYear() === currentYear
      );
    });
    
    const totalPaidThisMonth = paymentsThisMonth.reduce(
      (sum, payment) => sum + payment.amount,
      0
    );
    
    return {
      totalDebt,
      totalBalance,
      totalPaid,
      progress,
      activeDebts,
      paidDebts,
      overdueDebts,
      monthlyMinPayment,
      totalPaidThisMonth,
      paymentsThisMonth: paymentsThisMonth.length,
    };
  } catch (error) {
    console.error('Error calculando estadísticas:', error);
    throw error;
  }
}

/**
 * Actualiza el estado de las deudas (marcar como overdue si es necesario)
 */
export async function updateDebtStatuses(userId: string): Promise<void> {
  try {
    const debts = await getDebtsByUser(userId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (const debt of debts) {
      if (debt.status === 'active') {
        const dueDate = new Date(debt.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        
        if (dueDate < today) {
          await updateDebt(debt.id, userId, { status: 'overdue' });
        }
      }
    }
    
    console.log('✅ Estados de deudas actualizados');
  } catch (error) {
    console.error('Error actualizando estados:', error);
    throw error;
  }
}

// ============================================================================
// FUNCIONES DE USUARIO
// ============================================================================

/**
 * Guarda o actualiza información del usuario en Google Sheets
 */
export async function saveUser(user: {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
}) {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.USERS}!A2:F`,
    });
    
    const rows = response.data.values || [];
    const existingUserIndex = rows.findIndex(row => row[0] === user.id);
    const now = new Date().toISOString();
    
    const userData = [
      user.id,
      user.email,
      user.name || '',
      user.image || '',
      existingUserIndex === -1 ? now : rows[existingUserIndex][4], // createdAt
      now, // lastLogin
    ];
    
    if (existingUserIndex === -1) {
      // Crear nuevo usuario
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEETS.USERS}!A2`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [userData],
        },
      });
      console.log('✅ Usuario creado:', user.email);
    } else {
      // Actualizar usuario existente
      const actualRowNumber = existingUserIndex + 2;
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEETS.USERS}!A${actualRowNumber}:F${actualRowNumber}`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [userData],
        },
      });
      console.log('✅ Usuario actualizado:', user.email);
    }
  } catch (error) {
    console.error('Error guardando usuario:', error);
    throw error;
  }
}
