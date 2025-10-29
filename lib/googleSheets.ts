import { google } from 'googleapis';
import bcrypt from 'bcrypt';
import type { Debt, Payment, CreditCard, CreditCardPayment, CreditCardConsumption } from '@/types';

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
 * Elimina una tarjeta de crédito
 */
export async function deleteCreditCard(cardId: string, userId: string): Promise<void> {
  try {
    // Verificar si la hoja existe
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
    
    console.log('✅ Tarjeta de crédito eliminada:', cardId);
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
      range: `${SHEETS.CREDIT_CARD_CONSUMPTIONS}!A2:M`,
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
      }));
    
    return consumptions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  } catch (error) {
    console.error('Error obteniendo consumos de tarjeta:', error);
    throw error;
  }
}
