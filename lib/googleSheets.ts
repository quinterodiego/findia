import { google } from 'googleapis';
import bcrypt from 'bcrypt';
import type { Debt, Payment, CreditCard, CreditCardPayment, CreditCardConsumption, PDFImportTemplate, SmartTemplate } from '@/types';

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
  EXPENSES: 'Expenses',
  INCOMES: 'Incomes',
  GOALS: 'Goals',
  CREDIT_CARDS: 'CreditCards',
  CREDIT_CARD_PAYMENTS: 'CreditCardPayments',
  CREDIT_CARD_CONSUMPTIONS: 'CreditCardConsumptions',
  PDF_IMPORT_TEMPLATES: 'PDFImportTemplates',
  SHARED_EXPENSES: 'SharedExpenses',
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
      'categoryId',
      'subcategoryId',
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
      'password',
      'name',
      'image',
      'createdAt',
      'lastLogin',
    ]);
    
    // Verificar y actualizar headers de Users si falta la columna password
    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEETS.USERS}!A1:Z1`,
      });
      
      const currentHeaders = response.data.values?.[0] || [];
      
      // Si tiene headers antiguos (sin password o con estructura vieja)
      if (!currentHeaders.includes('password')) {
        console.log('🔄 Migrando hoja Users a nuevo formato...');
        
        // Leer todas las filas
        const allRowsResponse = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEETS.USERS}!A1:G`,
        });
        
        const rows = allRowsResponse.data.values || [];
        
        if (rows.length === 0) {
          // Si no hay datos, solo actualizar headers
          await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEETS.USERS}!A1:G1`,
            valueInputOption: 'RAW',
            requestBody: {
              values: [['id', 'email', 'password', 'name', 'image', 'createdAt', 'lastLogin']]
            }
          });
          console.log('✅ Headers actualizados en hoja Users');
          return;
        }
        
        // Si hay datos, necesitamos migrarlos correctamente
        const oldHeaders = rows[0] || [];
        const dataRows = rows.slice(1);
        
        console.log('📋 Headers antiguos:', oldHeaders);
        console.log('📊 Filas de datos:', dataRows.length);
        
        // Crear mapa de índices de columnas viejas
        const columnIndexes: any = {};
        oldHeaders.forEach((header, index) => {
          const lowerHeader = header?.toString().toLowerCase() || '';
          
          if (lowerHeader === 'id') columnIndexes.id = index;
          if (lowerHeader === 'email') columnIndexes.email = index;
          if (lowerHeader.includes('name') && !columnIndexes.name) columnIndexes.name = index;
          if (lowerHeader.includes('picture') || lowerHeader.includes('image')) columnIndexes.image = index;
          if (lowerHeader.includes('provider')) columnIndexes.provider = index;
          if (lowerHeader.includes('created')) columnIndexes.createdAt = index;
          if (lowerHeader.includes('login') || lowerHeader.includes('admin')) columnIndexes.lastLogin = index;
        });
        
        console.log('🗺️ Mapeo de columnas:', columnIndexes);
        
        // Crear datos migrados
        const migratedRows = dataRows.map(row => [
          columnIndexes.id !== undefined ? row[columnIndexes.id] : row[0],
          columnIndexes.email !== undefined ? row[columnIndexes.email] : row[1],
          '', // password vacío para usuarios existentes (OK si usan Google OAuth)
          columnIndexes.name !== undefined ? row[columnIndexes.name] : '',
          columnIndexes.image !== undefined ? row[columnIndexes.image] : '',
          columnIndexes.createdAt !== undefined ? row[columnIndexes.createdAt] : new Date().toISOString(),
          columnIndexes.lastLogin !== undefined ? row[columnIndexes.lastLogin] : new Date().toISOString()
        ]);
        
        // Actualizar headers Y datos
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEETS.USERS}!A1`,
          valueInputOption: 'RAW',
          requestBody: {
            values: [
              ['id', 'email', 'password', 'name', 'image', 'createdAt', 'lastLogin'],
              ...migratedRows
            ]
          }
        });
        
        console.log('✅ Hoja Users migrada correctamente con', migratedRows.length, 'usuarios');
      }
    } catch (error) {
      console.log('ℹ️ Error en migración o hoja Users ya tiene formato correcto:', error);
    }
    
    // Crear hoja de Expenses
    await createSheetIfNotExists(SHEETS.EXPENSES, [
      'id',
      'userId',
      'name',
      'amount',
      'date',
      'category',
      'expenseType',
      'notes',
      'isRecurring',
      'frequency',
      'createdAt',
    ]);
    
    // Crear hoja de Incomes
    await createSheetIfNotExists(SHEETS.INCOMES, [
      'id',
      'userId',
      'name',
      'amount',
      'date',
      'category',
      'notes',
      'isRecurring',
      'frequency',
      'createdAt',
    ]);
    
    // Crear hoja de Goals
    await createSheetIfNotExists(SHEETS.GOALS, [
      'id',
      'userId',
      'name',
      'amount',
      'currentAmount',
      'targetDate',
      'date',
      'category',
      'notes',
      'createdAt',
    ]);
    
    // Crear hoja de CreditCards
    await createSheetIfNotExists(SHEETS.CREDIT_CARDS, [
      'id',
      'userId',
      'name',
      'bank',
      'cardNumber',
      'limit',
      'currentBalance',
      'cutDate',
      'paymentDate',
      'interestRate',
      'status',
      'createdAt',
      'updatedAt',
    ]);
    
    // Crear hoja de CreditCardPayments
    await createSheetIfNotExists(SHEETS.CREDIT_CARD_PAYMENTS, [
      'id',
      'creditCardId',
      'userId',
      'amount',
      'date',
      'paymentMethod',
      'notes',
      'createdAt',
    ]);
    
    // Crear hoja de CreditCardConsumptions
    await createSheetIfNotExists(SHEETS.CREDIT_CARD_CONSUMPTIONS, [
      'id',
      'creditCardId',
      'userId',
      'merchant',
      'amount',
      'installments',
      'currentInstallment',
      'monthlyPayment',
      'date',
      'categoryId',
      'subcategoryId',
      'description',
      'createdAt',
    ]);
    
    // Crear hoja de PDFImportTemplates
    await createSheetIfNotExists(SHEETS.PDF_IMPORT_TEMPLATES, [
      'id',
      'creditCardId',
      'userId',
      'name',
      'datePattern',
      'amountPattern',
      'descriptionPattern',
      'installmentsPattern',
      'interestKeywords',
      'feeKeywords',
      'dateFormat',
      'amountDecimalSeparator',
      'amountThousandsSeparator',
      'searchRange',
      'skipLines',
      'createdAt',
      'updatedAt',
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
    categoryId: row[10] || '',
    subcategoryId: row[11] || '',
    notes: row[12] || '',
    createdAt: row[13],
    updatedAt: row[14],
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
    debt.categoryId,
    debt.subcategoryId,
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
      range: `${SHEETS.DEBTS}!A2:O`,
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
      range: `${SHEETS.DEBTS}!A2:O`,
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
      range: `${SHEETS.DEBTS}!A2:O`,
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
      range: `${SHEETS.DEBTS}!A${actualRowNumber}:O${actualRowNumber}`,
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
      range: `${SHEETS.DEBTS}!A2:O`,
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
 * Busca un usuario por email
 */
export async function getUserByEmail(email: string) {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.USERS}!A2:G`,
    });
    
    const rows = response.data.values || [];
    const user = rows.find(row => row[1]?.toLowerCase() === email.toLowerCase());
    
    if (!user || !user[0]) return null;
    
    return {
      id: user[0],
      email: user[1],
      password: user[2], // Hash del password
      name: user[3],
      image: user[4],
      createdAt: user[5],
      lastLogin: user[6],
    };
  } catch (error) {
    console.error('Error buscando usuario:', error);
    throw error;
  }
}

/**
 * Guarda o actualiza información del usuario en Google Sheets
 */
export async function saveUser(user: {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  password?: string;
}) {
  try {
    // Primero verificar si la hoja tiene el formato correcto
    try {
      const headersResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEETS.USERS}!A1:G1`,
      });
      
      const headers = headersResponse.data.values?.[0] || [];
      if (!headers.includes('password')) {
        // Ejecutar migración automáticamente
        console.log('🔄 Ejecutando migración automática de Users...');
        await initializeSheets();
      }
    } catch (migrationError) {
      console.log('⚠️ No se pudo verificar formato de hoja, continuando...');
    }
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.USERS}!A2:G`,
    });
    
    const rows = response.data.values || [];
    const existingUserIndex = rows.findIndex(row => row[0] === user.id);
    const now = new Date().toISOString();
    
    const userData = [
      user.id,
      user.email,
      user.password || '', // Password hasheado
      user.name || '',
      user.image || '',
      existingUserIndex === -1 ? now : rows[existingUserIndex][5], // createdAt
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
        range: `${SHEETS.USERS}!A${actualRowNumber}:G${actualRowNumber}`,
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

/**
 * Verifica credenciales de login
 */
export async function verifyCredentials(email: string, password: string) {
  try {
    const user = await getUserByEmail(email);
    if (!user || !user.password) return null;
    
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return null;
    
    return user;
  } catch (error) {
    console.error('Error verificando credenciales:', error);
    throw error;
  }
}

/**
 * Registra un nuevo usuario con email/password
 */
export async function registerUser(email: string, password: string, name: string) {
  try {
    // Verificar si el email ya existe
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      throw new Error('El email ya está registrado');
    }
    
    // Hashear password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Generar ID único
    const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    // Crear usuario
    await saveUser({
      id: userId,
      email,
      password: hashedPassword,
      name,
      image: null,
    });
    
    return { id: userId, email, name };
  } catch (error) {
    console.error('Error registrando usuario:', error);
    throw error;
  }
}

// ============================================================================
// OPERACIONES CRUD - EXPENSES
// ============================================================================

/**
 * Obtiene todos los gastos de un usuario
 */
export async function getExpensesByUser(userId: string): Promise<any[]> {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.EXPENSES}!A2:K`,
    });
    
    const rows = response.data.values || [];
    const expenses = rows
      .filter(row => row[1] === userId)
      .map(row => ({
        id: row[0],
        userId: row[1],
        name: row[2],
        amount: parseFloat(row[3] || '0'),
        date: row[4],
        category: row[5] || 'other',
        expenseType: row[6] || 'variable',
        notes: row[7] || '',
        isRecurring: row[8] === 'true',
        frequency: row[9] || 'monthly',
        createdAt: row[10] || new Date().toISOString(),
      }));
    
    return expenses;
  } catch (error) {
    console.error('Error obteniendo gastos:', error);
    throw error;
  }
}

/**
 * Crea un nuevo gasto
 */
export async function createExpense(
  userId: string,
  expenseData: {
    name: string;
    amount: number;
    date: string;
    category?: string;
    expenseType?: 'fixed' | 'variable';
    notes?: string;
    isRecurring?: boolean;
    frequency?: string;
  }
): Promise<any> {
  try {
    const now = new Date().toISOString();
    const newExpense = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId,
      ...expenseData,
      createdAt: now,
    };
    
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.EXPENSES}!A2`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[
          newExpense.id,
          newExpense.userId,
          newExpense.name,
          newExpense.amount,
          newExpense.date,
          newExpense.category || 'other',
          newExpense.expenseType || 'variable',
          newExpense.notes || '',
          newExpense.isRecurring || false,
          newExpense.frequency || 'monthly',
          newExpense.createdAt,
        ]],
      },
    });
    
    console.log('✅ Gasto creado:', newExpense.id);
    return newExpense;
  } catch (error) {
    console.error('Error creando gasto:', error);
    throw error;
  }
}

/**
 * Actualiza un gasto existente
 */
export async function updateExpense(
  expenseId: string,
  userId: string,
  expenseData: {
    name: string;
    amount: number;
    date: string;
    category?: string;
    expenseType?: 'fixed' | 'variable';
    notes?: string;
    isRecurring?: boolean;
    frequency?: string;
  }
): Promise<any> {
  try {
    console.log('🔍 updateExpense - Iniciando con:', { expenseId, userId, expenseData });
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.EXPENSES}!A2:K`,
    });
    
    const rows = response.data.values || [];
    const rowIndex = rows.findIndex(row => row[0] === expenseId && row[1] === userId);
    
    if (rowIndex === -1) {
      throw new Error('Gasto no encontrado');
    }
    
    const actualRowIndex = rowIndex + 2;
    
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.EXPENSES}!A${actualRowIndex}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[
          expenseId,
          userId,
          expenseData.name,
          expenseData.amount,
          expenseData.date,
          expenseData.category || 'other',
          expenseData.expenseType || 'variable',
          expenseData.notes || '',
          expenseData.isRecurring || false,
          expenseData.frequency || 'monthly',
          new Date().toISOString(),
        ]],
      },
    });
    
    console.log('✅ Gasto actualizado exitosamente:', expenseId);
    
    return {
      id: expenseId,
      userId,
      ...expenseData,
      updatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('❌ Error en updateExpense:', error);
    throw error;
  }
}

/**
 * Elimina un gasto
 */
export async function deleteExpense(expenseId: string, userId: string): Promise<void> {
  try {
    console.log('🔍 deleteExpense - Iniciando con:', { expenseId, userId });
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.EXPENSES}!A2:K`,
    });
    
    const rows = response.data.values || [];
    const rowIndex = rows.findIndex(row => row[0] === expenseId && row[1] === userId);
    
    if (rowIndex === -1) {
      throw new Error('Gasto no encontrado');
    }
    
    const actualRowIndex = rowIndex + 2;
    
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: await getSheetId(SHEETS.EXPENSES),
                dimension: 'ROWS',
                startIndex: actualRowIndex - 1,
                endIndex: actualRowIndex,
              },
            },
          },
        ],
      },
    });
    
    console.log('✅ Gasto eliminado exitosamente:', expenseId);
  } catch (error) {
    console.error('❌ Error en deleteExpense:', error);
    throw error;
  }
}

// ============================================================================
// OPERACIONES CRUD - SHARED EXPENSES
// ============================================================================

/**
 * Crea un gasto compartido
 */
export async function createSharedExpense(
  ownerUserId: string,
  data: {
    expenseId: string;
    sharedWithEmail: string;
    splitType: 'equal' | 'percentage' | 'amount';
    ownerAmount?: number;
    partnerAmount?: number;
    ownerPercentage?: number;
    partnerPercentage?: number;
    notes?: string;
  }
): Promise<any> {
  try {
    // Verificar y crear la hoja si no existe
    const exists = await sheetExists(SHEETS.SHARED_EXPENSES);
    if (!exists) {
      await createSheetIfNotExists(SHEETS.SHARED_EXPENSES, [
        'id',
        'expenseId',
        'ownerUserId',
        'sharedWithUserId',
        'splitType',
        'ownerAmount',
        'partnerAmount',
        'status',
        'createdAt',
        'acceptedAt',
        'rejectedAt',
        'notes',
        'isSettled',
        'settledAt',
      ]);
    }

    // Buscar el usuario por email
    const partnerUser = await getUserByEmail(data.sharedWithEmail);
    if (!partnerUser) {
      throw new Error('Usuario no encontrado. Asegúrate de que el email esté registrado en FindIA.');
    }

    // Obtener el gasto original
    const expenses = await getExpensesByUser(ownerUserId);
    const expense = expenses.find(e => e.id === data.expenseId);
    if (!expense) {
      throw new Error('Gasto no encontrado');
    }

    // Calcular montos según el tipo de división
    let ownerAmount = 0;
    let partnerAmount = 0;

    if (data.splitType === 'equal') {
      ownerAmount = expense.amount / 2;
      partnerAmount = expense.amount / 2;
    } else if (data.splitType === 'percentage') {
      if (!data.ownerPercentage || !data.partnerPercentage || data.ownerPercentage + data.partnerPercentage !== 100) {
        throw new Error('Los porcentajes deben sumar 100%');
      }
      ownerAmount = (expense.amount * data.ownerPercentage) / 100;
      partnerAmount = (expense.amount * data.partnerPercentage) / 100;
    } else if (data.splitType === 'amount') {
      if (!data.ownerAmount || !data.partnerAmount || data.ownerAmount + data.partnerAmount !== expense.amount) {
        throw new Error(`Los montos deben sumar ${expense.amount}`);
      }
      ownerAmount = data.ownerAmount;
      partnerAmount = data.partnerAmount;
    }

    const now = new Date().toISOString();
    const newSharedExpense = {
      id: generateId(),
      expenseId: data.expenseId,
      ownerUserId,
      sharedWithUserId: partnerUser.id,
      splitType: data.splitType,
      ownerAmount,
      partnerAmount,
      status: 'pending',
      createdAt: now,
      acceptedAt: null,
      rejectedAt: null,
      notes: data.notes || '',
    };

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.SHARED_EXPENSES}!A2`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[
          newSharedExpense.id,
          newSharedExpense.expenseId,
          newSharedExpense.ownerUserId,
          newSharedExpense.sharedWithUserId,
          newSharedExpense.splitType,
          newSharedExpense.ownerAmount,
          newSharedExpense.partnerAmount,
          newSharedExpense.status,
          newSharedExpense.createdAt,
          newSharedExpense.acceptedAt || '',
          newSharedExpense.rejectedAt || '',
          newSharedExpense.notes,
          false, // isSettled
          '', // settledAt
        ]],
      },
    });

    // Marcar el gasto como compartido
    try {
      await updateExpense(data.expenseId, ownerUserId, {
        ...expense,
        name: expense.name,
        amount: expense.amount,
        date: expense.date,
        category: expense.category,
        expenseType: expense.expenseType,
        notes: expense.notes,
        isRecurring: expense.isRecurring,
        frequency: expense.frequency,
      });
    } catch (err) {
      console.log('No se pudo actualizar el gasto como compartido:', err);
    }

    console.log('✅ Gasto compartido creado:', newSharedExpense.id);
    return newSharedExpense;
  } catch (error) {
    console.error('Error creando gasto compartido:', error);
    throw error;
  }
}

/**
 * Obtiene todos los gastos compartidos de un usuario (recibidos y enviados)
 */
export async function getSharedExpensesByUser(
  userId: string,
  filters?: {
    status?: 'pending' | 'accepted' | 'rejected' | 'cancellation_requested';
    type?: 'received' | 'sent' | 'all';
  }
): Promise<any[]> {
  try {
    const exists = await sheetExists(SHEETS.SHARED_EXPENSES);
    if (!exists) {
      return [];
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.SHARED_EXPENSES}!A2:N`,
    });

    const rows = response.data.values || [];
    let sharedExpenses = rows
      .filter(row => {
        const isOwner = row[2] === userId;
        const isPartner = row[3] === userId;
        return isOwner || isPartner;
      })
      .map(row => ({
        id: row[0],
        expenseId: row[1],
        ownerUserId: row[2],
        sharedWithUserId: row[3],
        splitType: row[4] as 'equal' | 'percentage' | 'amount',
        ownerAmount: parseFloat(row[5] || '0'),
        partnerAmount: parseFloat(row[6] || '0'),
        status: row[7] as 'pending' | 'accepted' | 'rejected' | 'cancellation_requested',
        createdAt: row[8] || new Date().toISOString(),
        acceptedAt: row[9] || null,
        rejectedAt: row[10] || null,
        notes: row[11] || '',
        isSettled: row[12] === 'true' || row[12] === true,
        settledAt: row[13] || null,
      }));

    // Aplicar filtros
    if (filters?.status) {
      sharedExpenses = sharedExpenses.filter(se => se.status === filters.status);
    }

    if (filters?.type) {
      if (filters.type === 'received') {
        sharedExpenses = sharedExpenses.filter(se => se.sharedWithUserId === userId);
      } else if (filters.type === 'sent') {
        sharedExpenses = sharedExpenses.filter(se => se.ownerUserId === userId);
      }
      // 'all' no filtra
    }

    // Obtener información del gasto y usuarios
    // Obtener todos los usuarios para buscar por ID
    const allUsersResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.USERS}!A2:G`,
    });
    const allUsersRows = allUsersResponse.data.values || [];
    const allUsers = allUsersRows.map(row => ({
      id: row[0],
      email: row[1],
      name: row[3] || '',
      image: row[4] || null,
    }));

    // Obtener gastos del usuario actual
    const expenses = await getExpensesByUser(userId);
    
    // Obtener gastos de otros usuarios si es necesario
    const allExpensesResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.EXPENSES}!A2:K`,
    });
    const allExpensesRows = allExpensesResponse.data.values || [];
    const allExpensesData = allExpensesRows.map(row => ({
      id: row[0],
      userId: row[1],
      name: row[2],
      amount: parseFloat(row[3] || '0'),
      date: row[4],
      category: row[5] || 'other',
      expenseType: row[6] || 'variable',
      notes: row[7] || '',
      isRecurring: row[8] === 'true',
      frequency: row[9] || 'monthly',
      createdAt: row[10] || new Date().toISOString(),
    }));

    const enrichedExpenses = sharedExpenses.map((se) => {
      // Buscar el gasto (puede ser del usuario actual o de otro usuario)
      const expense = allExpensesData.find(e => e.id === se.expenseId);
      
      // Buscar información de usuarios
      const owner = allUsers.find(u => u.id === se.ownerUserId);
      const partner = allUsers.find(u => u.id === se.sharedWithUserId);
      
      return {
        ...se,
        expense: expense || undefined,
        owner: owner ? {
          id: owner.id,
          name: owner.name,
          email: owner.email,
          image: owner.image,
        } : undefined,
        partner: partner ? {
          id: partner.id,
          name: partner.name,
          email: partner.email,
          image: partner.image,
        } : undefined,
      };
    });

    return enrichedExpenses;
  } catch (error) {
    console.error('Error obteniendo gastos compartidos:', error);
    throw error;
  }
}

/**
 * Acepta un gasto compartido
 */
export async function acceptSharedExpense(
  sharedExpenseId: string,
  userId: string
): Promise<void> {
  try {
    const exists = await sheetExists(SHEETS.SHARED_EXPENSES);
    if (!exists) {
      throw new Error('La hoja SharedExpenses no existe');
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.SHARED_EXPENSES}!A2:N`,
    });

    const rows = response.data.values || [];
    const rowIndex = rows.findIndex(row => row[0] === sharedExpenseId && row[3] === userId);

    if (rowIndex === -1) {
      throw new Error('Gasto compartido no encontrado o no tienes permisos para aceptarlo');
    }

    const actualRowIndex = rowIndex + 2;
    const row = rows[rowIndex];

    // Actualizar estado a 'accepted'
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.SHARED_EXPENSES}!H${actualRowIndex}:J${actualRowIndex}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [['accepted', new Date().toISOString(), '']],
      },
    });

    console.log('✅ Gasto compartido aceptado:', sharedExpenseId);
  } catch (error) {
    console.error('Error aceptando gasto compartido:', error);
    throw error;
  }
}

/**
 * Rechaza un gasto compartido
 */
export async function rejectSharedExpense(
  sharedExpenseId: string,
  userId: string
): Promise<void> {
  try {
    const exists = await sheetExists(SHEETS.SHARED_EXPENSES);
    if (!exists) {
      throw new Error('La hoja SharedExpenses no existe');
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.SHARED_EXPENSES}!A2:N`,
    });

    const rows = response.data.values || [];
    const rowIndex = rows.findIndex(row => row[0] === sharedExpenseId && row[3] === userId);

    if (rowIndex === -1) {
      throw new Error('Gasto compartido no encontrado o no tienes permisos para rechazarlo');
    }

    const actualRowIndex = rowIndex + 2;

    // Actualizar estado a 'rejected'
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.SHARED_EXPENSES}!H${actualRowIndex}:J${actualRowIndex}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [['rejected', '', new Date().toISOString()]],
      },
    });

    console.log('✅ Gasto compartido rechazado:', sharedExpenseId);
  } catch (error) {
    console.error('Error rechazando gasto compartido:', error);
    throw error;
  }
}

/**
 * Solicita cancelar un gasto compartido (solo el owner puede solicitar)
 * - Si está pendiente: lo cancela directamente
 * - Si está aceptado: cambia el estado a 'cancellation_requested' para que el partner confirme
 */
export async function cancelSharedExpense(
  sharedExpenseId: string,
  userId: string
): Promise<void> {
  try {
    const exists = await sheetExists(SHEETS.SHARED_EXPENSES);
    if (!exists) {
      throw new Error('La hoja SharedExpenses no existe');
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.SHARED_EXPENSES}!A2:N`,
    });

    const rows = response.data.values || [];
    const rowIndex = rows.findIndex(row => row[0] === sharedExpenseId && row[2] === userId);

    if (rowIndex === -1) {
      throw new Error('Gasto compartido no encontrado o no tienes permisos para cancelarlo');
    }

    const row = rows[rowIndex];
    const status = row[7] || 'pending';
    
    // Solo el owner puede cancelar
    if (row[2] !== userId) {
      throw new Error('Solo el dueño del gasto puede cancelarlo');
    }

    const actualRowIndex = rowIndex + 2;

    // Si está pendiente, cancelar directamente
    if (status === 'pending') {
      // Eliminar físicamente el gasto compartido
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [
            {
              deleteDimension: {
                range: {
                  sheetId: await getSheetId(SHEETS.SHARED_EXPENSES),
                  dimension: 'ROWS',
                  startIndex: actualRowIndex - 1,
                  endIndex: actualRowIndex,
                },
              },
            },
          ],
        },
      });
      console.log('✅ Gasto compartido cancelado (estaba pendiente):', sharedExpenseId);
    } else if (status === 'accepted') {
      // Si está aceptado, cambiar el estado a 'cancellation_requested'
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEETS.SHARED_EXPENSES}!H${actualRowIndex}`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [['cancellation_requested']],
        },
      });
      console.log('✅ Solicitud de cancelación enviada (estaba aceptado):', sharedExpenseId);
    } else {
      throw new Error('No se puede cancelar un gasto en este estado');
    }
  } catch (error) {
    console.error('Error cancelando gasto compartido:', error);
    throw error;
  }
}

/**
 * Confirma la cancelación de un gasto compartido (solo el partner puede confirmar)
 */
export async function confirmCancelSharedExpense(
  sharedExpenseId: string,
  userId: string
): Promise<void> {
  try {
    const exists = await sheetExists(SHEETS.SHARED_EXPENSES);
    if (!exists) {
      throw new Error('La hoja SharedExpenses no existe');
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.SHARED_EXPENSES}!A2:N`,
    });

    const rows = response.data.values || [];
    const rowIndex = rows.findIndex(row => row[0] === sharedExpenseId && row[3] === userId);

    if (rowIndex === -1) {
      throw new Error('Gasto compartido no encontrado o no tienes permisos para confirmar la cancelación');
    }

    const row = rows[rowIndex];
    const status = row[7] || 'pending';
    
    // Solo el partner puede confirmar la cancelación
    if (row[3] !== userId) {
      throw new Error('Solo el partner puede confirmar la cancelación');
    }

    // Debe estar en estado 'cancellation_requested'
    if (status !== 'cancellation_requested') {
      throw new Error('El gasto no está en estado de cancelación solicitada');
    }

    const actualRowIndex = rowIndex + 2;

    // Eliminar físicamente el gasto compartido
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: await getSheetId(SHEETS.SHARED_EXPENSES),
                dimension: 'ROWS',
                startIndex: actualRowIndex - 1,
                endIndex: actualRowIndex,
              },
            },
          },
        ],
      },
    });

    console.log('✅ Cancelación de gasto compartido confirmada:', sharedExpenseId);
  } catch (error) {
    console.error('Error confirmando cancelación de gasto compartido:', error);
    throw error;
  }
}

/**
 * Rechaza la solicitud de cancelación y restaura el estado a 'accepted'
 */
export async function rejectCancelSharedExpense(
  sharedExpenseId: string,
  userId: string
): Promise<void> {
  try {
    const exists = await sheetExists(SHEETS.SHARED_EXPENSES);
    if (!exists) {
      throw new Error('La hoja SharedExpenses no existe');
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.SHARED_EXPENSES}!A2:N`,
    });

    const rows = response.data.values || [];
    const rowIndex = rows.findIndex(row => row[0] === sharedExpenseId && row[3] === userId);

    if (rowIndex === -1) {
      throw new Error('Gasto compartido no encontrado o no tienes permisos para rechazar la cancelación');
    }

    const row = rows[rowIndex];
    const status = row[7] || 'pending';
    
    // Solo el partner puede rechazar la cancelación
    if (row[3] !== userId) {
      throw new Error('Solo el partner puede rechazar la cancelación');
    }

    // Debe estar en estado 'cancellation_requested'
    if (status !== 'cancellation_requested') {
      throw new Error('El gasto no está en estado de cancelación solicitada');
    }

    const actualRowIndex = rowIndex + 2;

    // Restaurar el estado a 'accepted'
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.SHARED_EXPENSES}!H${actualRowIndex}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [['accepted']],
      },
    });

    console.log('✅ Cancelación de gasto compartido rechazada, restaurado a aceptado:', sharedExpenseId);
  } catch (error) {
    console.error('Error rechazando cancelación de gasto compartido:', error);
    throw error;
  }
}

/**
 * Marca un gasto compartido como saldado (cuando la parte del otro usuario ya está pagada)
 * Solo el owner puede marcar como saldado cuando el partner pagó
 * Solo el partner puede marcar como saldado cuando el owner pagó
 */
export async function markSharedExpenseAsSettled(
  sharedExpenseId: string,
  userId: string
): Promise<void> {
  try {
    const exists = await sheetExists(SHEETS.SHARED_EXPENSES);
    if (!exists) {
      throw new Error('La hoja SharedExpenses no existe');
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.SHARED_EXPENSES}!A2:N`,
    });

    const rows = response.data.values || [];
    const rowIndex = rows.findIndex(row => row[0] === sharedExpenseId);

    if (rowIndex === -1) {
      throw new Error('Gasto compartido no encontrado');
    }

    const row = rows[rowIndex];
    const isOwner = row[2] === userId;
    const isPartner = row[3] === userId;

    if (!isOwner && !isPartner) {
      throw new Error('No tienes permisos para marcar este gasto como saldado');
    }

    // Solo se puede marcar como saldado si está aceptado
    const status = row[7] || 'pending';
    if (status !== 'accepted') {
      throw new Error('Solo se pueden marcar como saldados los gastos que están aceptados');
    }

    const actualRowIndex = rowIndex + 2;
    const now = new Date().toISOString();

    // Actualizar isSettled y settledAt
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.SHARED_EXPENSES}!M${actualRowIndex}:N${actualRowIndex}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [['true', now]],
      },
    });

    console.log('✅ Gasto compartido marcado como saldado:', sharedExpenseId);
  } catch (error) {
    console.error('Error marcando gasto compartido como saldado:', error);
    throw error;
  }
}

/**
 * Calcula el balance de gastos compartidos de un usuario
 */
export async function calculateSharedExpenseBalance(userId: string): Promise<{
  totalOwed: number;
  totalReceived: number;
  balance: number;
}> {
  try {
    const exists = await sheetExists(SHEETS.SHARED_EXPENSES);
    if (!exists) {
      return { totalOwed: 0, totalReceived: 0, balance: 0 };
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.SHARED_EXPENSES}!A2:N`,
    });

    const rows = response.data.values || [];
    const sharedExpenses = rows
      .filter(row => {
        const isOwner = row[2] === userId;
        const isPartner = row[3] === userId;
        const isAccepted = row[7] === 'accepted';
        return (isOwner || isPartner) && isAccepted;
      })
      .map(row => ({
        ownerUserId: row[2],
        sharedWithUserId: row[3],
        ownerAmount: parseFloat(row[5] || '0'),
        partnerAmount: parseFloat(row[6] || '0'),
      }));

    let totalOwed = 0; // Lo que te deben
    let totalReceived = 0; // Lo que debes

    sharedExpenses.forEach(se => {
      if (se.ownerUserId === userId) {
        // Tú creaste el gasto, te deben tu parte
        totalOwed += se.ownerAmount;
      } else if (se.sharedWithUserId === userId) {
        // Te compartieron un gasto, debes tu parte
        totalReceived += se.partnerAmount;
      }
    });

    const balance = totalOwed - totalReceived;

    return {
      totalOwed,
      totalReceived,
      balance,
    };
  } catch (error) {
    console.error('Error calculando balance de gastos compartidos:', error);
    throw error;
  }
}

// ============================================================================
// OPERACIONES CRUD - INCOMES
// ============================================================================

/**
 * Obtiene todos los ingresos de un usuario
 */
export async function getIncomesByUser(userId: string): Promise<any[]> {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.INCOMES}!A2:H`,
    });
    
    const rows = response.data.values || [];
    const incomes = rows
      .filter(row => row[1] === userId)
      .map(row => ({
        id: row[0],
        userId: row[1],
        name: row[2],
        amount: parseFloat(row[3] || '0'),
        date: row[4],
        category: row[5] || 'other',
        notes: row[6] || '',
        isRecurring: row[7] === 'true',
        frequency: row[8] || 'monthly',
        createdAt: row[9] || new Date().toISOString(),
      }));
    
    return incomes;
  } catch (error) {
    console.error('Error obteniendo ingresos:', error);
    throw error;
  }
}

/**
 * Crea un nuevo ingreso
 */
export async function createIncome(
  userId: string,
  incomeData: {
    name: string;
    amount: number;
    date: string;
    category?: string;
    notes?: string;
    isRecurring?: boolean;
    frequency?: string;
  }
): Promise<any> {
  try {
    console.log('🔍 createIncome - Iniciando con:', { userId, incomeData });
    
    const now = new Date().toISOString();
    const newIncome = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId,
      ...incomeData,
      createdAt: now,
    };
    
    console.log('📋 Datos del ingreso preparados:', newIncome);
    
    console.log('📤 Enviando a Google Sheets...');
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.INCOMES}!A2`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[
          newIncome.id,
          newIncome.userId,
          newIncome.name,
          newIncome.amount,
          newIncome.date,
          newIncome.category || 'other',
          newIncome.notes || '',
          newIncome.isRecurring || false,
          newIncome.frequency || 'monthly',
          newIncome.createdAt,
        ]],
      },
    });
    
    console.log('✅ Ingreso creado exitosamente en Google Sheets:', newIncome.id);
    return newIncome;
  } catch (error) {
    console.error('❌ Error en createIncome:', error);
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack');
    console.error('❌ Error message:', error instanceof Error ? error.message : 'No message');
    throw error;
  }
}

/**
 * Actualiza un ingreso existente
 */
export async function updateIncome(
  incomeId: string,
  userId: string,
  incomeData: {
    name: string;
    amount: number;
    date: string;
    category?: string;
    notes?: string;
    isRecurring?: boolean;
    frequency?: string;
  }
): Promise<any> {
  try {
    console.log('🔍 updateIncome - Iniciando con:', { incomeId, userId, incomeData });
    
    // Obtener todos los ingresos para encontrar la fila
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.INCOMES}!A2:K`,
    });
    
    const rows = response.data.values || [];
    const rowIndex = rows.findIndex(row => row[0] === incomeId && row[1] === userId);
    
    if (rowIndex === -1) {
      throw new Error('Ingreso no encontrado');
    }
    
    const actualRowIndex = rowIndex + 2; // +2 porque A2 es la primera fila de datos (A1 son headers)
    
    console.log('📋 Actualizando fila:', actualRowIndex);
    
    // Actualizar la fila
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.INCOMES}!A${actualRowIndex}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[
          incomeId,
          userId,
          incomeData.name,
          incomeData.amount,
          incomeData.date,
          incomeData.category || 'other',
          incomeData.notes || '',
          incomeData.isRecurring || false,
          incomeData.frequency || 'monthly',
          new Date().toISOString(), // updatedAt
        ]],
      },
    });
    
    console.log('✅ Ingreso actualizado exitosamente:', incomeId);
    
    return {
      id: incomeId,
      userId,
      ...incomeData,
      updatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('❌ Error en updateIncome:', error);
    throw error;
  }
}

/**
 * Elimina un ingreso
 */
export async function deleteIncome(incomeId: string, userId: string): Promise<void> {
  try {
    console.log('🔍 deleteIncome - Iniciando con:', { incomeId, userId });
    
    // Obtener todos los ingresos para encontrar la fila
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.INCOMES}!A2:K`,
    });
    
    const rows = response.data.values || [];
    const rowIndex = rows.findIndex(row => row[0] === incomeId && row[1] === userId);
    
    if (rowIndex === -1) {
      throw new Error('Ingreso no encontrado');
    }
    
    const actualRowIndex = rowIndex + 2; // +2 porque A2 es la primera fila de datos
    
    console.log('🗑️ Eliminando fila:', actualRowIndex);
    
    // Eliminar la fila
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: await getSheetId(SHEETS.INCOMES),
                dimension: 'ROWS',
                startIndex: actualRowIndex - 1,
                endIndex: actualRowIndex,
              },
            },
          },
        ],
      },
    });
    
    console.log('✅ Ingreso eliminado exitosamente:', incomeId);
  } catch (error) {
    console.error('❌ Error en deleteIncome:', error);
    throw error;
  }
}

/**
 * Obtiene el ID de una hoja por su nombre
 */
async function getSheetId(sheetName: string): Promise<number> {
  const response = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
  });
  
  const sheet = response.data.sheets?.find(s => s.properties?.title === sheetName);
  return sheet?.properties?.sheetId || 0;
}

// ============================================================================
// OPERACIONES CRUD - GOALS
// ============================================================================

/**
 * Obtiene todas las metas de un usuario
 */
export async function getGoalsByUser(userId: string): Promise<any[]> {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.GOALS}!A2:I`,
    });
    
    const rows = response.data.values || [];
    const goals = rows
      .filter(row => row[1] === userId)
      .map(row => ({
        id: row[0],
        userId: row[1],
        name: row[2],
        amount: parseFloat(row[3] || '0'),
        currentAmount: parseFloat(row[4] || '0'),
        targetDate: row[5],
        date: row[6],
        category: row[7] || 'savings',
        notes: row[8] || '',
        createdAt: row[9] || new Date().toISOString(),
      }));
    
    return goals;
  } catch (error) {
    console.error('Error obteniendo metas:', error);
    throw error;
  }
}

/**
 * Crea una nueva meta
 */
export async function createGoal(
  userId: string,
  goalData: {
    name: string;
    amount: number;
    currentAmount?: number;
    targetDate: string;
    date: string;
    category?: string;
    notes?: string;
  }
): Promise<any> {
  try {
    const now = new Date().toISOString();
    const newGoal = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId,
      ...goalData,
      createdAt: now,
    };
    
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.GOALS}!A2`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[
          newGoal.id,
          newGoal.userId,
          newGoal.name,
          newGoal.amount,
          newGoal.currentAmount || 0,
          newGoal.targetDate,
          newGoal.date,
          newGoal.category || 'savings',
          newGoal.notes || '',
          newGoal.createdAt,
        ]],
      },
    });
    
    console.log('✅ Meta creada:', newGoal.id);
    return newGoal;
  } catch (error) {
    console.error('Error creando meta:', error);
    throw error;
  }
}

/**
 * Actualiza una meta existente
 */
export async function updateGoal(
  goalId: string,
  userId: string,
  goalData: {
    name: string;
    amount: number;
    currentAmount?: number;
    targetDate: string;
    date: string;
    category?: string;
    notes?: string;
  }
): Promise<any> {
  try {
    console.log('🔍 updateGoal - Iniciando con:', { goalId, userId, goalData });
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.GOALS}!A2:J`,
    });
    
    const rows = response.data.values || [];
    const rowIndex = rows.findIndex(row => row[0] === goalId && row[1] === userId);
    
    if (rowIndex === -1) {
      throw new Error('Meta no encontrada');
    }
    
    const actualRowIndex = rowIndex + 2;
    
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.GOALS}!A${actualRowIndex}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[
          goalId,
          userId,
          goalData.name,
          goalData.amount,
          goalData.currentAmount || 0,
          goalData.targetDate,
          goalData.date,
          goalData.category || 'savings',
          goalData.notes || '',
          new Date().toISOString(),
        ]],
      },
    });
    
    console.log('✅ Meta actualizada exitosamente:', goalId);
    
    return {
      id: goalId,
      userId,
      ...goalData,
      updatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('❌ Error en updateGoal:', error);
    throw error;
  }
}

/**
 * Elimina una meta
 */
export async function deleteGoal(goalId: string, userId: string): Promise<void> {
  try {
    console.log('🔍 deleteGoal - Iniciando con:', { goalId, userId });
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.GOALS}!A2:J`,
    });
    
    const rows = response.data.values || [];
    const rowIndex = rows.findIndex(row => row[0] === goalId && row[1] === userId);
    
    if (rowIndex === -1) {
      throw new Error('Meta no encontrada');
    }
    
    const actualRowIndex = rowIndex + 2;
    
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: await getSheetId(SHEETS.GOALS),
                dimension: 'ROWS',
                startIndex: actualRowIndex - 1,
                endIndex: actualRowIndex,
              },
            },
          },
        ],
      },
    });
    
    console.log('✅ Meta eliminada exitosamente:', goalId);
  } catch (error) {
    console.error('❌ Error en deleteGoal:', error);
    throw error;
  }
}

// ============================================================================
// OPERACIONES CRUD - CREDIT CARDS
// ============================================================================

/**
 * Obtiene todas las tarjetas de crédito de un usuario
 */
export async function getCreditCardsByUser(userId: string): Promise<CreditCard[]> {
  try {
    // Verificar si la hoja existe antes de intentar leerla
    const exists = await sheetExists(SHEETS.CREDIT_CARDS);
    if (!exists) {
      console.log('Hoja CreditCards no existe, devolviendo array vacío');
      return [];
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.CREDIT_CARDS}!A2:M`,
    });
    
    const rows = response.data.values || [];
    const cards = rows
      .filter(row => row[1] === userId)
      .map(row => ({
        id: row[0],
        userId: row[1],
        name: row[2],
        bank: row[3],
        cardNumber: row[4],
        limit: parseFloat(row[5] || '0'),
        currentBalance: parseFloat(row[6] || '0'),
        cutDate: parseInt(row[7] || '1'),
        paymentDate: parseInt(row[8] || '1'),
        interestRate: parseFloat(row[9] || '0'),
        status: (row[10] as 'active' | 'blocked' | 'expired') || 'active',
        createdAt: row[11] || new Date().toISOString(),
        updatedAt: row[12] || new Date().toISOString(),
      }));
    
    return cards;
  } catch (error: any) {
    // Si el error es que la hoja no existe, devolver array vacío en lugar de fallar
    if (error?.code === 400 && error?.message?.includes('Unable to parse range')) {
      console.log('Hoja CreditCards no existe aún, devolviendo array vacío');
      return [];
    }
    console.error('Error obteniendo tarjetas de crédito:', error);
    throw error;
  }
}

/**
 * Crea una nueva tarjeta de crédito
 */
export async function createCreditCard(
  userId: string,
  cardData: {
    name: string;
    bank: string;
    cardNumber: string;
    limit: number;
    currentBalance: number;
    cutDate: number;
    paymentDate: number;
    interestRate: number;
    status?: 'active' | 'blocked' | 'expired';
  }
): Promise<CreditCard> {
  try {
    // Verificar y crear la hoja si no existe
    const exists = await sheetExists(SHEETS.CREDIT_CARDS);
    if (!exists) {
      await createSheetIfNotExists(SHEETS.CREDIT_CARDS, [
        'id',
        'userId',
        'name',
        'bank',
        'cardNumber',
        'limit',
        'currentBalance',
        'cutDate',
        'paymentDate',
        'interestRate',
        'status',
        'createdAt',
        'updatedAt',
      ]);
    }

    const now = new Date().toISOString();
    const newCard: CreditCard = {
      id: generateId(),
      userId,
      name: cardData.name,
      bank: cardData.bank,
      cardNumber: cardData.cardNumber,
      limit: cardData.limit,
      currentBalance: cardData.currentBalance,
      cutDate: cardData.cutDate,
      paymentDate: cardData.paymentDate,
      interestRate: cardData.interestRate,
      status: cardData.status || 'active',
      createdAt: now,
      updatedAt: now,
    };
    
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.CREDIT_CARDS}!A2`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[
          newCard.id,
          newCard.userId,
          newCard.name,
          newCard.bank,
          newCard.cardNumber,
          newCard.limit,
          newCard.currentBalance,
          newCard.cutDate,
          newCard.paymentDate,
          newCard.interestRate,
          newCard.status,
          newCard.createdAt,
          newCard.updatedAt,
        ]],
      },
    });
    
    console.log('✅ Tarjeta de crédito creada:', newCard.id);
    return newCard;
  } catch (error) {
    console.error('Error creando tarjeta de crédito:', error);
    throw error;
  }
}

/**
 * Actualiza una tarjeta de crédito existente
 */
export async function updateCreditCard(
  cardId: string,
  userId: string,
  cardData: Partial<{
    name: string;
    bank: string;
    cardNumber: string;
    limit: number;
    currentBalance: number;
    cutDate: number;
    paymentDate: number;
    interestRate: number;
    status: 'active' | 'blocked' | 'expired';
  }>
): Promise<CreditCard> {
  try {
    // Asegurar que la hoja existe antes de intentar actualizar
    const exists = await sheetExists(SHEETS.CREDIT_CARDS);
    if (!exists) {
      throw new Error('La hoja CreditCards no existe. Inicializa las hojas primero.');
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.CREDIT_CARDS}!A2:M`,
    });
    
    const rows = response.data.values || [];
    const rowIndex = rows.findIndex(row => row[0] === cardId && row[1] === userId);
    
    if (rowIndex === -1) {
      throw new Error('Tarjeta de crédito no encontrada');
    }
    
    const currentRow = rows[rowIndex];
    const actualRowIndex = rowIndex + 2;
    
    const updatedCard: CreditCard = {
      id: currentRow[0],
      userId: currentRow[1],
      name: cardData.name ?? currentRow[2],
      bank: cardData.bank ?? currentRow[3],
      cardNumber: cardData.cardNumber ?? currentRow[4],
      limit: cardData.limit !== undefined ? cardData.limit : parseFloat(currentRow[5]),
      currentBalance: cardData.currentBalance !== undefined ? cardData.currentBalance : parseFloat(currentRow[6]),
      cutDate: cardData.cutDate !== undefined ? cardData.cutDate : parseInt(currentRow[7]),
      paymentDate: cardData.paymentDate !== undefined ? cardData.paymentDate : parseInt(currentRow[8]),
      interestRate: cardData.interestRate !== undefined ? cardData.interestRate : parseFloat(currentRow[9]),
      status: (cardData.status ?? currentRow[10]) as 'active' | 'blocked' | 'expired',
      createdAt: currentRow[11],
      updatedAt: new Date().toISOString(),
    };
    
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.CREDIT_CARDS}!A${actualRowIndex}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[
          updatedCard.id,
          updatedCard.userId,
          updatedCard.name,
          updatedCard.bank,
          updatedCard.cardNumber,
          updatedCard.limit,
          updatedCard.currentBalance,
          updatedCard.cutDate,
          updatedCard.paymentDate,
          updatedCard.interestRate,
          updatedCard.status,
          updatedCard.createdAt,
          updatedCard.updatedAt,
        ]],
      },
    });
    
    console.log('✅ Tarjeta de crédito actualizada:', cardId);
    return updatedCard;
  } catch (error) {
    console.error('Error actualizando tarjeta de crédito:', error);
    throw error;
  }
}

/**
 * Elimina todos los consumos de una tarjeta de crédito
 */
async function deleteCreditCardConsumptions(cardId: string, userId: string): Promise<void> {
  try {
    const exists = await sheetExists(SHEETS.CREDIT_CARD_CONSUMPTIONS);
    if (!exists) {
      return; // Si la hoja no existe, no hay nada que eliminar
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.CREDIT_CARD_CONSUMPTIONS}!A2:M`,
    });
    
    const rows = response.data.values || [];
    // Encontrar todas las filas relacionadas con esta tarjeta
    const matchingRows: number[] = [];
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][1] === cardId && rows[i][2] === userId) {
        matchingRows.push(i + 2); // +2 porque empieza en fila 2 (después del header)
      }
    }
    
    if (matchingRows.length === 0) {
      return; // No hay consumos para eliminar
    }
    
    // Eliminar las filas de abajo hacia arriba para evitar que cambien los índices
    matchingRows.sort((a, b) => b - a);
    
    const sheetId = await getSheetId(SHEETS.CREDIT_CARD_CONSUMPTIONS);
    const deleteRequests = matchingRows.map(rowIndex => ({
      deleteDimension: {
        range: {
          sheetId: sheetId,
          dimension: 'ROWS',
          startIndex: rowIndex - 1,
          endIndex: rowIndex,
        },
      },
    }));
    
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: deleteRequests,
      },
    });
    
    console.log(`✅ ${matchingRows.length} consumos eliminados para tarjeta:`, cardId);
  } catch (error) {
    console.error('Error eliminando consumos de tarjeta:', error);
    // No lanzar el error, solo loguear
  }
}

/**
 * Elimina todos los pagos de una tarjeta de crédito
 */
async function deleteCreditCardPayments(cardId: string, userId: string): Promise<void> {
  try {
    const exists = await sheetExists(SHEETS.CREDIT_CARD_PAYMENTS);
    if (!exists) {
      return; // Si la hoja no existe, no hay nada que eliminar
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.CREDIT_CARD_PAYMENTS}!A2:H`,
    });
    
    const rows = response.data.values || [];
    // Encontrar todas las filas relacionadas con esta tarjeta
    const matchingRows: number[] = [];
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][1] === cardId && rows[i][2] === userId) {
        matchingRows.push(i + 2); // +2 porque empieza en fila 2 (después del header)
      }
    }
    
    if (matchingRows.length === 0) {
      return; // No hay pagos para eliminar
    }
    
    // Eliminar las filas de abajo hacia arriba para evitar que cambien los índices
    matchingRows.sort((a, b) => b - a);
    
    const sheetId = await getSheetId(SHEETS.CREDIT_CARD_PAYMENTS);
    const deleteRequests = matchingRows.map(rowIndex => ({
      deleteDimension: {
        range: {
          sheetId: sheetId,
          dimension: 'ROWS',
          startIndex: rowIndex - 1,
          endIndex: rowIndex,
        },
      },
    }));
    
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: deleteRequests,
      },
    });
    
    console.log(`✅ ${matchingRows.length} pagos eliminados para tarjeta:`, cardId);
  } catch (error) {
    console.error('Error eliminando pagos de tarjeta:', error);
    // No lanzar el error, solo loguear
  }
}

/**
 * Elimina todos los templates (incluyendo smart templates) de una tarjeta de crédito
 */
async function deleteCreditCardTemplates(cardId: string, userId: string): Promise<void> {
  try {
    const exists = await sheetExists(SHEETS.PDF_IMPORT_TEMPLATES);
    if (!exists) {
      return; // Si la hoja no existe, no hay nada que eliminar
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.PDF_IMPORT_TEMPLATES}!A2:Z`,
    });
    
    const rows = response.data.values || [];
    // Encontrar todas las filas relacionadas con esta tarjeta
    const matchingRows: number[] = [];
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][1] === cardId && rows[i][2] === userId) {
        matchingRows.push(i + 2); // +2 porque empieza en fila 2 (después del header)
      }
    }
    
    if (matchingRows.length === 0) {
      return; // No hay templates para eliminar
    }
    
    // Eliminar las filas de abajo hacia arriba para evitar que cambien los índices
    matchingRows.sort((a, b) => b - a);
    
    const sheetId = await getSheetId(SHEETS.PDF_IMPORT_TEMPLATES);
    const deleteRequests = matchingRows.map(rowIndex => ({
      deleteDimension: {
        range: {
          sheetId: sheetId,
          dimension: 'ROWS',
          startIndex: rowIndex - 1,
          endIndex: rowIndex,
        },
      },
    }));
    
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: deleteRequests,
      },
    });
    
    console.log(`✅ ${matchingRows.length} templates eliminados para tarjeta:`, cardId);
  } catch (error) {
    console.error('Error eliminando templates de tarjeta:', error);
    // No lanzar el error, solo loguear
  }
}

/**
 * Elimina una tarjeta de crédito y todos sus datos relacionados
 */
export async function deleteCreditCard(cardId: string, userId: string): Promise<void> {
  try {
    // Primero eliminar todos los datos relacionados
    console.log(`🗑️ Iniciando eliminación de tarjeta ${cardId} y todos sus datos relacionados...`);
    
    await deleteCreditCardConsumptions(cardId, userId);
    await deleteCreditCardPayments(cardId, userId);
    await deleteCreditCardTemplates(cardId, userId);
    
    // Finalmente eliminar la tarjeta
    const exists = await sheetExists(SHEETS.CREDIT_CARDS);
    if (!exists) {
      throw new Error('La hoja CreditCards no existe.');
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.CREDIT_CARDS}!A2:M`,
    });
    
    const rows = response.data.values || [];
    const rowIndex = rows.findIndex(row => row[0] === cardId && row[1] === userId);
    
    if (rowIndex === -1) {
      throw new Error('Tarjeta de crédito no encontrada');
    }
    
    const actualRowIndex = rowIndex + 2;
    
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: await getSheetId(SHEETS.CREDIT_CARDS),
                dimension: 'ROWS',
                startIndex: actualRowIndex - 1,
                endIndex: actualRowIndex,
              },
            },
          },
        ],
      },
    });
    
    console.log('✅ Tarjeta de crédito eliminada completamente:', cardId);
  } catch (error) {
    console.error('Error eliminando tarjeta de crédito:', error);
    throw error;
  }
}

/**
 * Registra un pago de tarjeta de crédito
 */
export async function createCreditCardPayment(
  userId: string,
  paymentData: {
    creditCardId: string;
    amount: number;
    date: string;
    paymentMethod: 'transfer' | 'cash' | 'debit' | 'other';
    notes?: string;
  }
): Promise<CreditCardPayment> {
  try {
    // Verificar y crear la hoja si no existe
    const exists = await sheetExists(SHEETS.CREDIT_CARD_PAYMENTS);
    if (!exists) {
      await createSheetIfNotExists(SHEETS.CREDIT_CARD_PAYMENTS, [
        'id',
        'creditCardId',
        'userId',
        'amount',
        'date',
        'paymentMethod',
        'notes',
        'createdAt',
      ]);
    }

    const now = new Date().toISOString();
    const newPayment: CreditCardPayment = {
      id: generateId(),
      creditCardId: paymentData.creditCardId,
      userId,
      amount: paymentData.amount,
      date: paymentData.date,
      paymentMethod: paymentData.paymentMethod,
      notes: paymentData.notes,
      createdAt: now,
    };
    
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.CREDIT_CARD_PAYMENTS}!A2`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[
          newPayment.id,
          newPayment.creditCardId,
          newPayment.userId,
          newPayment.amount,
          newPayment.date,
          newPayment.paymentMethod,
          newPayment.notes || '',
          newPayment.createdAt,
        ]],
      },
    });
    
    // Actualizar el balance de la tarjeta
    try {
      const card = await getCreditCardsByUser(userId);
      const targetCard = card.find(c => c.id === paymentData.creditCardId);
      if (targetCard) {
        await updateCreditCard(paymentData.creditCardId, userId, {
          currentBalance: Math.max(0, targetCard.currentBalance - paymentData.amount),
        });
      }
    } catch (err) {
      console.log('No se pudo actualizar el balance de la tarjeta (puede que la hoja no exista aún):', err);
    }
    
    console.log('✅ Pago de tarjeta registrado:', newPayment.id);
    return newPayment;
  } catch (error) {
    console.error('Error registrando pago de tarjeta:', error);
    throw error;
  }
}

/**
 * Obtiene los pagos de una tarjeta de crédito
 */
export async function getCreditCardPayments(
  cardId: string,
  userId: string
): Promise<CreditCardPayment[]> {
  try {
    // Verificar si la hoja existe
    const exists = await sheetExists(SHEETS.CREDIT_CARD_PAYMENTS);
    if (!exists) {
      return [];
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.CREDIT_CARD_PAYMENTS}!A2:H`,
    });
    
    const rows = response.data.values || [];
    const payments = rows
      .filter(row => row[1] === cardId && row[2] === userId)
      .map(row => ({
        id: row[0],
        creditCardId: row[1],
        userId: row[2],
        amount: parseFloat(row[3] || '0'),
        date: row[4],
        paymentMethod: (row[5] as 'transfer' | 'cash' | 'debit' | 'other') || 'transfer',
        notes: row[6],
        createdAt: row[7],
      }));
    
    return payments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  } catch (error) {
    console.error('Error obteniendo pagos de tarjeta:', error);
    throw error;
  }
}

/**
 * Obtiene todos los consumos de una tarjeta de crédito
 */
export async function getCreditCardConsumptions(
  cardId: string,
  userId: string
): Promise<CreditCardConsumption[]> {
  try {
    // Verificar si la hoja existe
    const exists = await sheetExists(SHEETS.CREDIT_CARD_CONSUMPTIONS);
    if (!exists) {
      return [];
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.CREDIT_CARD_CONSUMPTIONS}!A2:O`,
    });
    
    const rows = response.data.values || [];
    const consumptions = rows
      .filter(row => row[1] === cardId && row[2] === userId)
      .map(row => ({
        id: row[0],
        creditCardId: row[1],
        userId: row[2],
        merchant: row[3],
        amount: parseFloat(row[4] || '0'),
        installments: parseInt(row[5] || '1'),
        currentInstallment: parseInt(row[6] || '1'),
        monthlyPayment: parseFloat(row[7] || '0'),
        date: row[8],
        categoryId: row[9] || '',
        subcategoryId: row[10] || '',
        description: row[11] || '',
        createdAt: row[12],
        montoPesos: row[13] ? parseFloat(row[13]) : undefined,
        montoUSD: row[14] ? parseFloat(row[14]) : undefined,
      }));
      
      return consumptions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  } catch (error) {
    console.error('Error obteniendo consumos de tarjeta:', error);
    throw error;
  }
}

/**
 * Crea un nuevo consumo de tarjeta de crédito
 */
export async function createCreditCardConsumption(
  consumptionData: {
    creditCardId: string;
    userId: string;
    merchant: string;
    amount: number;
    installments: number;
    currentInstallment: number;
    monthlyPayment: number;
    date: string; // dd/mm/aaaa
    categoryId?: string;
    subcategoryId?: string;
    description?: string;
    createdAt?: string;
    montoPesos?: number;
    montoUSD?: number;
  }
): Promise<CreditCardConsumption> {
  try {
    // Verificar y crear la hoja si no existe
    const exists = await sheetExists(SHEETS.CREDIT_CARD_CONSUMPTIONS);
    if (!exists) {
      await createSheetIfNotExists(SHEETS.CREDIT_CARD_CONSUMPTIONS, [
        'id',
        'creditCardId',
        'userId',
        'merchant',
        'amount',
        'installments',
        'currentInstallment',
        'monthlyPayment',
        'date',
        'categoryId',
        'subcategoryId',
        'description',
        'createdAt',
        'montoPesos',
        'montoUSD',
      ]);
    }

    const now = consumptionData.createdAt || new Date().toISOString();
    const newConsumption: CreditCardConsumption = {
      id: generateId(),
      creditCardId: consumptionData.creditCardId,
      userId: consumptionData.userId,
      merchant: consumptionData.merchant,
      amount: consumptionData.amount,
      installments: consumptionData.installments,
      currentInstallment: consumptionData.currentInstallment,
      monthlyPayment: consumptionData.monthlyPayment,
      date: consumptionData.date,
      categoryId: consumptionData.categoryId,
      subcategoryId: consumptionData.subcategoryId,
      description: consumptionData.description,
      createdAt: now,
    };
    
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.CREDIT_CARD_CONSUMPTIONS}!A2`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[
          newConsumption.id,
          newConsumption.creditCardId,
          newConsumption.userId,
          newConsumption.merchant,
          newConsumption.amount,
          newConsumption.installments,
          newConsumption.currentInstallment,
          newConsumption.monthlyPayment,
          newConsumption.date,
          newConsumption.categoryId || '',
          newConsumption.subcategoryId || '',
          newConsumption.description || '',
          newConsumption.createdAt,
          consumptionData.montoPesos !== undefined ? consumptionData.montoPesos : consumptionData.amount,
          consumptionData.montoUSD !== undefined ? consumptionData.montoUSD : 0,
        ]],
      },
    });
    
    console.log('✅ Consumo de tarjeta registrado:', newConsumption.id);
    return newConsumption;
  } catch (error) {
    console.error('Error registrando consumo de tarjeta:', error);
    throw error;
  }
}

/**
 * Actualiza un consumo existente de tarjeta de crédito
 */
export async function updateCreditCardConsumption(
  consumptionId: string,
  userId: string,
  updates: Partial<{
    merchant: string;
    amount: number;
    installments: number;
    currentInstallment: number;
    monthlyPayment: number;
    date: string;
    categoryId: string;
    subcategoryId: string;
    description: string;
    montoPesos?: number;
    montoUSD?: number;
  }>
): Promise<CreditCardConsumption> {
  try {
    const exists = await sheetExists(SHEETS.CREDIT_CARD_CONSUMPTIONS);
    if (!exists) {
      throw new Error('Consumo no existe');
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.CREDIT_CARD_CONSUMPTIONS}!A2:M`,
    });
    
    const rows = response.data.values || [];
    const rowIndex = rows.findIndex(r => r[0] === consumptionId && r[2] === userId);
    
    if (rowIndex === -1) {
      throw new Error('Consumo no encontrado');
    }
    
    const row = rows[rowIndex];
    const current: CreditCardConsumption & { montoPesos?: number; montoUSD?: number } = {
      id: row[0],
      creditCardId: row[1],
      userId: row[2],
      merchant: row[3],
      amount: parseFloat(row[4] || '0'),
      installments: parseInt(row[5] || '1'),
      currentInstallment: parseInt(row[6] || '1'),
      monthlyPayment: parseFloat(row[7] || '0'),
      date: row[8],
      categoryId: row[9] || '',
      subcategoryId: row[10] || '',
      description: row[11] || '',
      createdAt: row[12],
      montoPesos: row[13] ? parseFloat(row[13]) : undefined,
      montoUSD: row[14] ? parseFloat(row[14]) : undefined,
    };
    
    // El amount ya es la cuota mensual, no el total
    // Para calcular el total original: amount * installments
    const newAmount = updates.amount !== undefined ? updates.amount : current.amount;
    const newInstallments = updates.installments !== undefined ? updates.installments : current.installments;
    // monthlyPayment es igual a amount (la cuota mensual)
    const recalculatedMonthlyPayment = newAmount;
    
    const updated: CreditCardConsumption & { montoPesos?: number; montoUSD?: number } = {
      ...current,
      merchant: updates.merchant ?? current.merchant,
      amount: updates.amount ?? current.amount,
      installments: updates.installments ?? current.installments,
      currentInstallment: updates.currentInstallment ?? current.currentInstallment,
      monthlyPayment: updates.monthlyPayment ?? recalculatedMonthlyPayment,
      date: updates.date ?? current.date,
      categoryId: updates.categoryId !== undefined ? updates.categoryId : current.categoryId,
      subcategoryId: updates.subcategoryId !== undefined ? updates.subcategoryId : current.subcategoryId,
      description: updates.description !== undefined ? updates.description : current.description,
      montoPesos: updates.montoPesos !== undefined ? updates.montoPesos : current.montoPesos,
      montoUSD: updates.montoUSD !== undefined ? updates.montoUSD : current.montoUSD,
    };
    
    // Asegurar que monthlyPayment esté recalculado si cambió amount
    // monthlyPayment siempre es igual a amount (la cuota mensual)
    if (updates.amount !== undefined || updates.installments !== undefined) {
      updated.monthlyPayment = updated.amount;
    }
    
    // Asegurar que montoPesos y montoUSD tengan valores por defecto si son undefined
    const finalMontoPesos = updated.montoPesos !== undefined && updated.montoPesos !== null ? updated.montoPesos : updated.amount
    const finalMontoUSD = updated.montoUSD !== undefined && updated.montoUSD !== null ? updated.montoUSD : 0
    
    const rangeRow = rowIndex + 2; // +2 porque empieza en fila 2 (después del header)
    
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.CREDIT_CARD_CONSUMPTIONS}!A${rangeRow}:O${rangeRow}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[
          updated.id,
          updated.creditCardId,
          updated.userId,
          updated.merchant,
          updated.amount,
          updated.installments,
          updated.currentInstallment,
          updated.monthlyPayment,
          updated.date,
          updated.categoryId || '',
          updated.subcategoryId || '',
          updated.description || '',
          updated.createdAt,
          finalMontoPesos,
          finalMontoUSD,
        ]],
      },
    });
    
    console.log('✅ Consumo de tarjeta actualizado:', consumptionId);
    console.log('[updateCreditCardConsumption] Valores guardados:', {
      montoPesos: finalMontoPesos,
      montoUSD: finalMontoUSD,
      amount: updated.amount
    });
    
    // Devolver el objeto con montoPesos y montoUSD explícitamente incluidos
    return {
      ...updated,
      montoPesos: finalMontoPesos,
      montoUSD: finalMontoUSD,
    } as CreditCardConsumption & { montoPesos: number; montoUSD: number };
  } catch (error) {
    console.error('Error actualizando consumo de tarjeta:', error);
    throw error;
  }
}

// ============================================================================
// PDF IMPORT TEMPLATES
// ============================================================================

/**
 * Obtiene todos los templates de importación PDF para una tarjeta
 */
export async function getPDFImportTemplates(
  cardId: string,
  userId: string
): Promise<PDFImportTemplate[]> {
  try {
    const exists = await sheetExists(SHEETS.PDF_IMPORT_TEMPLATES);
    if (!exists) {
      return [];
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.PDF_IMPORT_TEMPLATES}!A2:R`,
    });
    
    const rows = response.data.values || [];
    const templates = rows
      .filter(row => row[1] === cardId && row[2] === userId)
      .map(row => ({
        id: row[0],
        creditCardId: row[1],
        userId: row[2],
        name: row[3] || '',
        datePattern: row[4] || undefined,
        amountPattern: row[5] || undefined,
        descriptionPattern: row[6] || undefined,
        installmentsPattern: row[7] || undefined,
        interestKeywords: row[8] ? JSON.parse(row[8]) : undefined,
        feeKeywords: row[9] ? JSON.parse(row[9]) : undefined,
        dateFormat: row[10] as any || undefined,
        amountDecimalSeparator: row[11] as any || undefined,
        amountThousandsSeparator: row[12] as any || undefined,
        searchRange: row[13] ? parseInt(row[13]) : undefined,
        skipLines: row[14] ? JSON.parse(row[14]) : undefined,
        createdAt: row[15],
        updatedAt: row[16],
      }));
    
    return templates;
  } catch (error) {
    console.error('Error obteniendo templates:', error);
    throw error;
  }
}

/**
 * Obtiene un template específico por ID
 */
export async function getPDFImportTemplate(
  templateId: string,
  userId: string
): Promise<PDFImportTemplate | null> {
  try {
    const exists = await sheetExists(SHEETS.PDF_IMPORT_TEMPLATES);
    if (!exists) {
      return null;
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.PDF_IMPORT_TEMPLATES}!A2:R`,
    });
    
    const rows = response.data.values || [];
    const row = rows.find(r => r[0] === templateId && r[2] === userId);
    
    if (!row) return null;
    
    return {
      id: row[0],
      creditCardId: row[1],
      userId: row[2],
      name: row[3] || '',
      datePattern: row[4] || undefined,
      amountPattern: row[5] || undefined,
      descriptionPattern: row[6] || undefined,
      installmentsPattern: row[7] || undefined,
      interestKeywords: row[8] ? JSON.parse(row[8]) : undefined,
      feeKeywords: row[9] ? JSON.parse(row[9]) : undefined,
      dateFormat: row[10] as any || undefined,
      amountDecimalSeparator: row[11] as any || undefined,
      amountThousandsSeparator: row[12] as any || undefined,
      searchRange: row[13] ? parseInt(row[13]) : undefined,
      skipLines: row[14] ? JSON.parse(row[14]) : undefined,
      createdAt: row[15],
      updatedAt: row[16],
    };
  } catch (error) {
    console.error('Error obteniendo template:', error);
    throw error;
  }
}

/**
 * Crea un nuevo template de importación PDF
 */
export async function createPDFImportTemplate(
  templateData: {
    creditCardId: string;
    userId: string;
    name: string;
    datePattern?: string;
    amountPattern?: string;
    descriptionPattern?: string;
    installmentsPattern?: string;
    interestKeywords?: string[];
    feeKeywords?: string[];
    dateFormat?: 'dd/mm/yyyy' | 'dd-mm-yyyy' | 'mm/dd/yyyy' | 'yyyy-mm-dd';
    amountDecimalSeparator?: ',' | '.';
    amountThousandsSeparator?: ',' | '.';
    searchRange?: number;
    skipLines?: string[];
  }
): Promise<PDFImportTemplate> {
  try {
    const exists = await sheetExists(SHEETS.PDF_IMPORT_TEMPLATES);
    if (!exists) {
      await createSheetIfNotExists(SHEETS.PDF_IMPORT_TEMPLATES, [
        'id',
        'creditCardId',
        'userId',
        'name',
        'datePattern',
        'amountPattern',
        'descriptionPattern',
        'installmentsPattern',
        'interestKeywords',
        'feeKeywords',
        'dateFormat',
        'amountDecimalSeparator',
        'amountThousandsSeparator',
        'searchRange',
        'skipLines',
        'createdAt',
        'updatedAt',
      ]);
    }

    const now = new Date().toISOString();
    const newTemplate: PDFImportTemplate = {
      id: generateId(),
      creditCardId: templateData.creditCardId,
      userId: templateData.userId,
      name: templateData.name,
      datePattern: templateData.datePattern,
      amountPattern: templateData.amountPattern,
      descriptionPattern: templateData.descriptionPattern,
      installmentsPattern: templateData.installmentsPattern,
      interestKeywords: templateData.interestKeywords,
      feeKeywords: templateData.feeKeywords,
      dateFormat: templateData.dateFormat,
      amountDecimalSeparator: templateData.amountDecimalSeparator,
      amountThousandsSeparator: templateData.amountThousandsSeparator,
      searchRange: templateData.searchRange,
      skipLines: templateData.skipLines,
      createdAt: now,
      updatedAt: now,
    };
    
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.PDF_IMPORT_TEMPLATES}!A2`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[
          newTemplate.id,
          newTemplate.creditCardId,
          newTemplate.userId,
          newTemplate.name,
          newTemplate.datePattern || '',
          newTemplate.amountPattern || '',
          newTemplate.descriptionPattern || '',
          newTemplate.installmentsPattern || '',
          newTemplate.interestKeywords ? JSON.stringify(newTemplate.interestKeywords) : '',
          newTemplate.feeKeywords ? JSON.stringify(newTemplate.feeKeywords) : '',
          newTemplate.dateFormat || '',
          newTemplate.amountDecimalSeparator || '',
          newTemplate.amountThousandsSeparator || '',
          newTemplate.searchRange?.toString() || '',
          newTemplate.skipLines ? JSON.stringify(newTemplate.skipLines) : '',
          newTemplate.createdAt,
          newTemplate.updatedAt,
        ]],
      },
    });
    
    console.log('✅ Template creado:', newTemplate.id);
    return newTemplate;
  } catch (error) {
    console.error('Error creando template:', error);
    throw error;
  }
}

/**
 * Actualiza un template existente
 */
export async function updatePDFImportTemplate(
  templateId: string,
  userId: string,
  updates: Partial<Omit<PDFImportTemplate, 'id' | 'creditCardId' | 'userId' | 'createdAt'>>
): Promise<PDFImportTemplate> {
  try {
    const exists = await sheetExists(SHEETS.PDF_IMPORT_TEMPLATES);
    if (!exists) {
      throw new Error('Template no existe');
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.PDF_IMPORT_TEMPLATES}!A2:R`,
    });
    
    const rows = response.data.values || [];
    const rowIndex = rows.findIndex(r => r[0] === templateId && r[2] === userId);
    
    if (rowIndex === -1) {
      throw new Error('Template no encontrado');
    }
    
    const row = rows[rowIndex];
    const current: PDFImportTemplate = {
      id: row[0],
      creditCardId: row[1],
      userId: row[2],
      name: row[3] || '',
      datePattern: row[4] || undefined,
      amountPattern: row[5] || undefined,
      descriptionPattern: row[6] || undefined,
      installmentsPattern: row[7] || undefined,
      interestKeywords: row[8] ? JSON.parse(row[8]) : undefined,
      feeKeywords: row[9] ? JSON.parse(row[9]) : undefined,
      dateFormat: row[10] as any || undefined,
      amountDecimalSeparator: row[11] as any || undefined,
      amountThousandsSeparator: row[12] as any || undefined,
      searchRange: row[13] ? parseInt(row[13]) : undefined,
      skipLines: row[14] ? JSON.parse(row[14]) : undefined,
      createdAt: row[15],
      updatedAt: row[16],
    };
    
    const updated: PDFImportTemplate = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    
    const rangeRow = rowIndex + 2; // +2 porque empieza en fila 2 (después del header)
    
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.PDF_IMPORT_TEMPLATES}!A${rangeRow}:R${rangeRow}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[
          updated.id,
          updated.creditCardId,
          updated.userId,
          updated.name,
          updated.datePattern || '',
          updated.amountPattern || '',
          updated.descriptionPattern || '',
          updated.installmentsPattern || '',
          updated.interestKeywords ? JSON.stringify(updated.interestKeywords) : '',
          updated.feeKeywords ? JSON.stringify(updated.feeKeywords) : '',
          updated.dateFormat || '',
          updated.amountDecimalSeparator || '',
          updated.amountThousandsSeparator || '',
          updated.searchRange?.toString() || '',
          updated.skipLines ? JSON.stringify(updated.skipLines) : '',
          updated.createdAt,
          updated.updatedAt,
        ]],
      },
    });
    
    console.log('✅ Template actualizado:', templateId);
    return updated;
  } catch (error) {
    console.error('Error actualizando template:', error);
    throw error;
  }
}

/**
 * Elimina un template
 */
export async function deletePDFImportTemplate(
  templateId: string,
  userId: string
): Promise<void> {
  try {
    const exists = await sheetExists(SHEETS.PDF_IMPORT_TEMPLATES);
    if (!exists) {
      throw new Error('Template no existe');
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.PDF_IMPORT_TEMPLATES}!A2:R`,
    });
    
    const rows = response.data.values || [];
    const rowIndex = rows.findIndex(r => r[0] === templateId && r[2] === userId);
    
    if (rowIndex === -1) {
      throw new Error('Template no encontrado');
    }
    
    const rangeRow = rowIndex + 2;
    
    await sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.PDF_IMPORT_TEMPLATES}!A${rangeRow}:R${rangeRow}`,
    });
    
    // Eliminar la fila vacía moviendo las demás hacia arriba
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId: await getSheetId(SHEETS.PDF_IMPORT_TEMPLATES),
              dimension: 'ROWS',
              startIndex: rangeRow - 1,
              endIndex: rangeRow,
            },
          },
        }],
      },
    });
    
    console.log('✅ Template eliminado:', templateId);
  } catch (error) {
    console.error('Error eliminando template:', error);
    throw error;
  }
}

// ============================================================================
// SMART TEMPLATES (Plantillas Inteligentes)
// ============================================================================

/**
 * Obtiene el smart template para una tarjeta (o crea uno si no existe)
 */
export async function getSmartTemplate(
  cardId: string,
  userId: string
): Promise<SmartTemplate | null> {
  try {
    const exists = await sheetExists(SHEETS.PDF_IMPORT_TEMPLATES);
    if (!exists) {
      return null;
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.PDF_IMPORT_TEMPLATES}!A2:Z`,
    });
    
    const rows = response.data.values || [];
    // Buscar el template para esta tarjeta (normalmente solo hay uno por tarjeta)
    const row = rows.find(r => r[1] === cardId && r[2] === userId);
    
    if (!row) return null;
    
    // Construir el template base primero
    const baseTemplate: PDFImportTemplate = {
      id: row[0],
      creditCardId: row[1],
      userId: row[2],
      name: row[3] || '',
      datePattern: row[4] || undefined,
      amountPattern: row[5] || undefined,
      descriptionPattern: row[6] || undefined,
      installmentsPattern: row[7] || undefined,
      interestKeywords: row[8] ? JSON.parse(row[8]) : undefined,
      feeKeywords: row[9] ? JSON.parse(row[9]) : undefined,
      dateFormat: row[10] as any || undefined,
      amountDecimalSeparator: row[11] as any || undefined,
      amountThousandsSeparator: row[12] as any || undefined,
      searchRange: row[13] ? parseInt(row[13]) : undefined,
      skipLines: row[14] ? JSON.parse(row[14]) : undefined,
      createdAt: row[15],
      updatedAt: row[16],
    };

    // Agregar campos de SmartTemplate
    const smartTemplate: SmartTemplate = {
      ...baseTemplate,
      regexFecha: row[17] || undefined,
      regexMonto: row[18] || undefined,
      seccionConsumosStart: row[19] || undefined,
      seccionConsumosEnd: row[20] || undefined,
      mapeoComercios: row[21] ? JSON.parse(row[21]) : undefined,
      totalImports: row[22] ? parseInt(row[22]) : undefined,
      accuracy: row[23] ? parseFloat(row[23]) : undefined,
      lastUsed: row[24] || undefined,
    };
    
    return smartTemplate;
  } catch (error) {
    console.error('Error obteniendo smart template:', error);
    throw error;
  }
}

/**
 * Guarda o actualiza un smart template
 */
export async function saveSmartTemplate(
  smartTemplate: Partial<SmartTemplate> & { creditCardId: string; userId: string }
): Promise<SmartTemplate> {
  try {
    const exists = await sheetExists(SHEETS.PDF_IMPORT_TEMPLATES);
    if (!exists) {
      // Crear la hoja con columnas extendidas para smart templates
      await createSheetIfNotExists(SHEETS.PDF_IMPORT_TEMPLATES, [
        'id',
        'creditCardId',
        'userId',
        'name',
        'datePattern',
        'amountPattern',
        'descriptionPattern',
        'installmentsPattern',
        'interestKeywords',
        'feeKeywords',
        'dateFormat',
        'amountDecimalSeparator',
        'amountThousandsSeparator',
        'searchRange',
        'skipLines',
        'createdAt',
        'updatedAt',
        'regexFecha',
        'regexMonto',
        'seccionConsumosStart',
        'seccionConsumosEnd',
        'mapeoComercios',
        'totalImports',
        'accuracy',
        'lastUsed',
      ]);
    }

    // Buscar si ya existe un template para esta tarjeta
    const existing = await getSmartTemplate(smartTemplate.creditCardId, smartTemplate.userId);
    
    const now = new Date().toISOString();
    let finalTemplate: SmartTemplate;
    
    if (existing) {
      // Actualizar template existente
      finalTemplate = {
        ...existing,
        ...smartTemplate,
        updatedAt: now,
        totalImports: (existing.totalImports || 0) + 1,
        lastUsed: now,
      } as SmartTemplate;
      
      // Actualizar en Google Sheets
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEETS.PDF_IMPORT_TEMPLATES}!A2:Z`,
      });
      
      const rows = response.data.values || [];
      const rowIndex = rows.findIndex(r => r[0] === existing.id && r[2] === smartTemplate.userId);
      
      if (rowIndex !== -1) {
        const rangeRow = rowIndex + 2;
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEETS.PDF_IMPORT_TEMPLATES}!A${rangeRow}:Z${rangeRow}`,
          valueInputOption: 'RAW',
          requestBody: {
            values: [[
              finalTemplate.id,
              finalTemplate.creditCardId,
              finalTemplate.userId,
              finalTemplate.name || '',
              finalTemplate.datePattern || '',
              finalTemplate.amountPattern || '',
              finalTemplate.descriptionPattern || '',
              finalTemplate.installmentsPattern || '',
              finalTemplate.interestKeywords ? JSON.stringify(finalTemplate.interestKeywords) : '',
              finalTemplate.feeKeywords ? JSON.stringify(finalTemplate.feeKeywords) : '',
              finalTemplate.dateFormat || '',
              finalTemplate.amountDecimalSeparator || '',
              finalTemplate.amountThousandsSeparator || '',
              finalTemplate.searchRange?.toString() || '',
              finalTemplate.skipLines ? JSON.stringify(finalTemplate.skipLines) : '',
              finalTemplate.createdAt,
              finalTemplate.updatedAt,
              finalTemplate.regexFecha || '',
              finalTemplate.regexMonto || '',
              finalTemplate.seccionConsumosStart || '',
              finalTemplate.seccionConsumosEnd || '',
              finalTemplate.mapeoComercios ? JSON.stringify(finalTemplate.mapeoComercios) : '',
              finalTemplate.totalImports?.toString() || '',
              finalTemplate.accuracy?.toString() || '',
              finalTemplate.lastUsed || '',
            ]],
          },
        });
      }
    } else {
      // Crear nuevo template
      finalTemplate = {
        id: generateId(),
        creditCardId: smartTemplate.creditCardId,
        userId: smartTemplate.userId,
        name: smartTemplate.name || 'Plantilla Inteligente',
        datePattern: smartTemplate.datePattern,
        amountPattern: smartTemplate.amountPattern,
        descriptionPattern: smartTemplate.descriptionPattern,
        installmentsPattern: smartTemplate.installmentsPattern,
        interestKeywords: smartTemplate.interestKeywords,
        feeKeywords: smartTemplate.feeKeywords,
        dateFormat: smartTemplate.dateFormat,
        amountDecimalSeparator: smartTemplate.amountDecimalSeparator,
        amountThousandsSeparator: smartTemplate.amountThousandsSeparator,
        searchRange: smartTemplate.searchRange,
        skipLines: smartTemplate.skipLines,
        regexFecha: smartTemplate.regexFecha,
        regexMonto: smartTemplate.regexMonto,
        seccionConsumosStart: smartTemplate.seccionConsumosStart,
        seccionConsumosEnd: smartTemplate.seccionConsumosEnd,
        mapeoComercios: smartTemplate.mapeoComercios,
        totalImports: 1,
        accuracy: smartTemplate.accuracy || 0,
        lastUsed: now,
        createdAt: now,
        updatedAt: now,
      } as SmartTemplate;
      
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEETS.PDF_IMPORT_TEMPLATES}!A2`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [[
            finalTemplate.id,
            finalTemplate.creditCardId,
            finalTemplate.userId,
            finalTemplate.name || '',
            finalTemplate.datePattern || '',
            finalTemplate.amountPattern || '',
            finalTemplate.descriptionPattern || '',
            finalTemplate.installmentsPattern || '',
            finalTemplate.interestKeywords ? JSON.stringify(finalTemplate.interestKeywords) : '',
            finalTemplate.feeKeywords ? JSON.stringify(finalTemplate.feeKeywords) : '',
            finalTemplate.dateFormat || '',
            finalTemplate.amountDecimalSeparator || '',
            finalTemplate.amountThousandsSeparator || '',
            finalTemplate.searchRange?.toString() || '',
            finalTemplate.skipLines ? JSON.stringify(finalTemplate.skipLines) : '',
            finalTemplate.createdAt,
            finalTemplate.updatedAt,
            finalTemplate.regexFecha || '',
            finalTemplate.regexMonto || '',
            finalTemplate.seccionConsumosStart || '',
            finalTemplate.seccionConsumosEnd || '',
            finalTemplate.mapeoComercios ? JSON.stringify(finalTemplate.mapeoComercios) : '',
            finalTemplate.totalImports?.toString() || '',
            finalTemplate.accuracy?.toString() || '',
            finalTemplate.lastUsed || '',
          ]],
        },
      });
    }
    
    console.log('✅ Smart template guardado:', finalTemplate.id);
    return finalTemplate;
  } catch (error) {
    console.error('Error guardando smart template:', error);
    throw error;
  }
}
