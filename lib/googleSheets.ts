import { google } from 'googleapis';
import bcrypt from 'bcrypt';
import type { Debt, Payment, CreditCard, CreditCardPayment, CreditCardConsumption, PDFImportTemplate, SmartTemplate, SharedGroup, SharedGroupMember, SharedGroupExpense, SharedGroupSplit, SharedGroupSettlement, SharedGroupPairBalance, SharedGroupInvitation, SharedGroupInvitationWithDetails } from '@/types';
import { parseCivilDate } from '@/lib/formatDate';
import { computeGroupBalances, validateSettlementAgainstBalance, validateSharedGroupExpenseInput } from '@/lib/sharedGroupBalances';
import { normalizeInvitationEmail, generateInvitationToken, hashInvitationToken, validateInvitationTransition } from '@/lib/sharedGroupInvitations';

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
  // Gastos Compartidos V2 (grupos con N miembros) — coexisten con SHARED_EXPENSES,
  // que sigue siendo el sistema 1:1 y no se toca.
  SHARED_GROUPS: 'SharedGroups',
  SHARED_GROUP_MEMBERS: 'SharedGroupMembers',
  SHARED_GROUP_EXPENSES: 'SharedGroupExpenses',
  SHARED_GROUP_SPLITS: 'SharedGroupSplits',
  SHARED_GROUP_SETTLEMENTS: 'SharedGroupSettlements',
  SHARED_GROUP_INVITATIONS: 'SharedGroupInvitations',
} as const;

// ============================================================================
// INICIALIZACIÓN DE HOJAS
// ============================================================================

// ============================================================================
// Clasificación de errores de la API de Google Sheets (googleapis/gaxios).
// Helpers chicos y específicos — no una jerarquía de errores nueva. Se usan
// para distinguir "la hoja/rango no existe todavía" (seguro tratar como
// vacío) de un problema real de infraestructura (429/5xx/auth), que nunca
// debe enmascararse como si el dato simplemente no existiera.
// ============================================================================

interface GoogleApiErrorShape {
  code?: number;
  status?: number | string;
  message?: string;
  response?: { status?: number };
  errors?: Array<{ message?: string }>;
}

function getGoogleApiErrorStatus(error: unknown): number | undefined {
  const err = error as GoogleApiErrorShape | undefined;
  const status = err?.code ?? err?.response?.status;
  return typeof status === 'number' ? status : undefined;
}

/** True si el error es un 429 (cuota de lecturas/escrituras excedida) real de Google Sheets. */
export function isGoogleSheetsRateLimitError(error: unknown): boolean {
  return getGoogleApiErrorStatus(error) === 429;
}

/** True si el error es un 5xx (o similar, sin código HTTP claro) de infraestructura de Google. */
export function isGoogleSheetsInfrastructureError(error: unknown): boolean {
  const status = getGoogleApiErrorStatus(error);
  return typeof status === 'number' && status >= 500;
}

/**
 * True SOLO si el error es específicamente "no se pudo interpretar el rango"
 * (Google Sheets responde 400 con ese mensaje puntual cuando la hoja/tab
 * referenciada no existe todavía) — la ÚNICA situación en la que corresponde
 * tratar el error como "sin datos", nunca por defecto ante cualquier 400.
 */
function isGoogleSheetsNotFoundError(error: unknown): boolean {
  const err = error as GoogleApiErrorShape | undefined;
  if (getGoogleApiErrorStatus(error) !== 400) return false;
  const message = err?.message || err?.errors?.[0]?.message || '';
  return /unable to parse range/i.test(message);
}

/**
 * Verifica si una hoja existe en el spreadsheet.
 *
 * IMPORTANTE: `spreadsheets.get()` trae los metadatos de TODO el spreadsheet
 * (todas sus hojas) — nunca falla porque una hoja puntual no exista, eso
 * simplemente no aparece en `response.data.sheets`. Por lo tanto, si esta
 * llamada TIRA una excepción, nunca es un "la hoja no existe" legítimo: es
 * siempre un problema de infraestructura (429 de cuota, 5xx transitorio,
 * error de auth/config, red). Antes se atrapaba cualquier error acá y se
 * devolvía `false`, lo que hacía que un 429 real terminara interpretándose
 * como "la hoja no existe" en cada caller. Ahora el error se propaga tal
 * cual — cada caller ya está dentro de un `async function` con su propio
 * try/catch que relanza, así que esto no cambia su forma, solo evita que la
 * excepción real quede enmascarada como `false`.
 */
async function sheetExists(sheetName: string): Promise<boolean> {
  const response = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
  });

  return response.data.sheets?.some(sheet => sheet.properties?.title === sheetName) || false;
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
      'paymentMethod',
      'totalInstallments',
      'remainingInstallments',
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
      'googleVerifiedAt',
      'googleOnlyIdentity',
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
          return;
        }
        
        // Si hay datos, necesitamos migrarlos correctamente
        const oldHeaders = rows[0] || [];
        const dataRows = rows.slice(1);
        
        
        // Crear mapa de índices de columnas viejas
        const columnIndexes: Record<string, number> = {};
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
        
      }
    } catch (error) {
    }

    // Verificar y agregar las columnas de identidad (googleVerifiedAt /
    // googleOnlyIdentity) si faltan. A diferencia de la migración de
    // 'password' de arriba, estas son columnas puramente NUEVAS al final de
    // la fila -- nunca reordenan ni reescriben datos existentes. Una fila
    // vieja que quede sin estas columnas simplemente se lee como
    // "desconocido" (ver getUserByEmail), nunca se infiere un valor.
    try {
      const identityHeadersResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEETS.USERS}!A1:Z1`,
      });
      const currentIdentityHeaders = identityHeadersResponse.data.values?.[0] || [];
      if (!currentIdentityHeaders.includes('googleVerifiedAt') || !currentIdentityHeaders.includes('googleOnlyIdentity')) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEETS.USERS}!A1:I1`,
          valueInputOption: 'RAW',
          requestBody: {
            values: [['id', 'email', 'password', 'name', 'image', 'createdAt', 'lastLogin', 'googleVerifiedAt', 'googleOnlyIdentity']],
          },
        });
      }
    } catch (error) {
    }

    // Crear hoja de Expenses
    await createSheetIfNotExists(SHEETS.EXPENSES, [
      'id',
      'userId',
      'name',
      'amount',
      'date',
      'category',
      'subcategoryId',
      'expenseType',
      'notes',
      'isRecurring',
      'frequency',
      'createdAt',
      'totalInstallments',
      'currentInstallment',
      'paymentMethod',
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
    paymentMethod: row[15] as 'automatic' | 'manual' | 'transfer' || undefined,
    totalInstallments: row[16] ? parseInt(row[16]) : undefined,
    remainingInstallments: row[17] ? parseInt(row[17]) : undefined,
    debtType: (row[18] as 'prestamo' | 'tarjeta' | 'credito') || undefined,
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
    debt.status || '',
    debt.categoryId || '',
    debt.subcategoryId || '',
    debt.notes || '',
    debt.createdAt,
    debt.updatedAt,
    debt.paymentMethod || '',
    debt.totalInstallments || '',
    debt.remainingInstallments || '',
    debt.debtType || '',
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
    payment.type || '',
    payment.notes || '',
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
      range: `${SHEETS.DEBTS}!A2:R`,
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
      range: `${SHEETS.DEBTS}!A2:R`,
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
      range: `${SHEETS.DEBTS}!A2:R`,
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
      range: `${SHEETS.DEBTS}!A${actualRowNumber}:R${actualRowNumber}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [debtToRow(updatedDebt)],
      },
    });
    
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
      range: `${SHEETS.DEBTS}!A2:R`,
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
      const newStatus: 'active' | 'paid' | 'overdue' = newBalance <= 0 ? 'paid' : (debt.status ?? 'active');
      
      await updateDebt(debtId, userId, {
        balance: Math.max(0, newBalance),
        status: newStatus,
      });
    }
    
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
      range: `${SHEETS.USERS}!A2:I`,
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
      // Fase 4.4.1: nunca se infiere -- ausente/legacy queda undefined, no false.
      googleVerifiedAt: user[7] || undefined,
      googleOnlyIdentity: user[8] === 'true' ? true : user[8] === 'false' ? false : undefined,
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
  /** Fase 4.4.1: true SOLO cuando este llamado corresponde a un login real
   * por Google que acaba de ocurrir (ver lib/auth.ts). Nunca lo pasa
   * registerUser. */
  markGoogleVerified?: boolean;
  /**
   * Fase 4.4.1 -- semántica CONSERVADORA, ver lib/userIdentity.ts:
   *   true  -> SOLO cuando se sabe con certeza que esta fila se está
   *            creando desde cero mediante Google (nunca existió antes).
   *   false -> SOLO cuando se sabe con certeza que esta fila se está
   *            creando desde cero mediante Credentials.
   *   undefined (omitido) -> NO tocar el valor existente. Se preserva tal
   *            cual estaba (nunca se convierte una ausencia en `false`).
   */
  googleOnlyIdentity?: boolean;
}): Promise<string> {
  try {
    // Primero verificar si la hoja tiene el formato correcto
    try {
      const headersResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEETS.USERS}!A1:I1`,
      });

      const headers = headersResponse.data.values?.[0] || [];
      if (!headers.includes('password') || !headers.includes('googleVerifiedAt') || !headers.includes('googleOnlyIdentity')) {
        // Ejecutar migración automáticamente
        await initializeSheets();
      }
    } catch (migrationError) {
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.USERS}!A2:I`,
    });

    const rows = response.data.values || [];
    // Buscar por ID primero, luego por email como fallback (para usuarios de Google)
    let existingUserIndex = rows.findIndex(row => row[0] === user.id);
    if (existingUserIndex === -1) {
      // Si no se encuentra por ID, buscar por email (para casos donde el ID cambió)
      existingUserIndex = rows.findIndex(row => row[1]?.toLowerCase() === user.email.toLowerCase());
    }

    const now = new Date().toISOString();

    // Si se encontró por email pero con ID diferente, usar el ID existente
    const finalUserId = existingUserIndex !== -1 ? rows[existingUserIndex][0] : user.id;
    const createdAt = existingUserIndex !== -1 ? rows[existingUserIndex][5] : now;
    // Preservar el hash existente si no se proporciona password nuevo (ej: login con Google)
    const existingPassword = existingUserIndex !== -1 ? (rows[existingUserIndex][2] || '') : '';
    const existingGoogleVerifiedAt = existingUserIndex !== -1 ? (rows[existingUserIndex][7] || '') : '';
    const existingGoogleOnlyIdentityRaw = existingUserIndex !== -1 ? rows[existingUserIndex][8] : undefined;

    const finalGoogleVerifiedAt = user.markGoogleVerified ? now : existingGoogleVerifiedAt;
    // Conservador: solo se escribe un valor explícito si el llamador lo pasa;
    // si no, se preserva EXACTAMENTE lo que ya había (nunca undefined/legacy -> 'false').
    const finalGoogleOnlyIdentity =
      user.googleOnlyIdentity !== undefined
        ? (user.googleOnlyIdentity ? 'true' : 'false')
        : existingGoogleOnlyIdentityRaw === 'true' || existingGoogleOnlyIdentityRaw === 'false'
          ? existingGoogleOnlyIdentityRaw
          : '';

    const userData = [
      finalUserId,
      user.email,
      user.password !== undefined ? user.password : existingPassword,
      user.name || '',
      user.image || '',
      createdAt, // Mantener createdAt original si existe
      now, // lastLogin siempre se actualiza
      finalGoogleVerifiedAt,
      finalGoogleOnlyIdentity,
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
    } else {
      // Actualizar usuario existente
      const actualRowNumber = existingUserIndex + 2;
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEETS.USERS}!A${actualRowNumber}:I${actualRowNumber}`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [userData],
        },
      });
    }

    // Retornar el ID final para que se use consistentemente
    return finalUserId;
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
    
    // Crear usuario -- googleOnlyIdentity: false explícito porque esta fila
    // se crea desde cero mediante Credentials (Fase 4.4.1, ver lib/userIdentity.ts).
    await saveUser({
      id: userId,
      email,
      password: hashedPassword,
      name,
      image: null,
      googleOnlyIdentity: false,
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
export async function getExpensesByUser(userId: string): Promise<any[]> { // eslint-disable-line @typescript-eslint/no-explicit-any
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.EXPENSES}!A2:O`,
    });
    
    const rows = response.data.values || [];
    const expenses = rows
      .filter(row => row[1] === userId)
      .map(row => {
        // Filtrar valores "false" o booleanos false en notes
        let notesValue = row[8] || '';
        if (notesValue === 'false' || notesValue === false || notesValue === 'FALSE') {
          notesValue = '';
        }
        
        return {
          id: row[0],
          userId: row[1],
          name: row[2],
          amount: parseFloat(row[3] || '0'),
          date: row[4],
          category: row[5] || 'other',
          subcategoryId: row[6] || '',
          expenseType: row[7] || 'variable',
          notes: notesValue,
          isRecurring: row[9] === 'true',
          frequency: row[10] || 'monthly',
          createdAt: row[11] || new Date().toISOString(),
          totalInstallments: row[12] ? parseInt(row[12]) : undefined,
          currentInstallment: row[13] ? parseInt(row[13]) : undefined,
          paymentMethod: row[14] || undefined,
        };
      });
    
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
    subcategoryId?: string;
    expenseType?: 'fixed' | 'variable' | 'installments';
    notes?: string;
    isRecurring?: boolean;
    frequency?: string;
    totalInstallments?: number;
    currentInstallment?: number;
    paymentMethod?: 'automatic' | 'manual' | 'transfer';
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
          newExpense.subcategoryId || '',
          newExpense.expenseType || 'variable',
          newExpense.notes || '',
          newExpense.isRecurring || false,
          newExpense.frequency || 'monthly',
          newExpense.createdAt,
          newExpense.totalInstallments || '',
          newExpense.currentInstallment || '',
          newExpense.paymentMethod || '',
        ]],
      },
    });
    
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
    subcategoryId?: string;
    expenseType?: 'fixed' | 'variable' | 'installments';
    notes?: string;
    isRecurring?: boolean;
    frequency?: string;
    totalInstallments?: number;
    currentInstallment?: number;
    paymentMethod?: 'automatic' | 'manual' | 'transfer';
  }
): Promise<any> {
  try {
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.EXPENSES}!A2:O`,
    });
    
    const rows = response.data.values || [];
    const rowIndex = rows.findIndex(row => row[0] === expenseId && row[1] === userId);
    
    if (rowIndex === -1) {
      throw new Error('Gasto no encontrado');
    }
    
    const actualRowIndex = rowIndex + 2;
    
    // Obtener valores existentes para mantener los campos que no se actualizan
    const existingRow = rows[rowIndex];
    
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
          expenseData.subcategoryId || '',
          expenseData.expenseType || 'variable',
          expenseData.notes || '',
          expenseData.isRecurring || false,
          expenseData.frequency || 'monthly',
          existingRow[11] || new Date().toISOString(), // Mantener createdAt original (ahora en índice 11)
          expenseData.totalInstallments || '',
          expenseData.currentInstallment || '',
          expenseData.paymentMethod || '',
        ]],
      },
    });
    
    
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
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.EXPENSES}!A2:O`,
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
    }

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
      range: `${SHEETS.EXPENSES}!A2:O`,
    });
    const allExpensesRows = allExpensesResponse.data.values || [];
    const allExpensesData = allExpensesRows.map(row => ({
      id: row[0],
      userId: row[1],
      name: row[2],
      amount: parseFloat(row[3] || '0'),
      date: row[4],
      category: row[5] || 'other',
      subcategoryId: row[6] || '',
      expenseType: row[7] || 'variable',
      notes: row[8] || '',
      isRecurring: row[9] === 'true',
      totalInstallments: row[12] ? parseInt(row[12]) : undefined,
      currentInstallment: row[13] ? parseInt(row[13]) : undefined,
      paymentMethod: row[14] || undefined,
      frequency: row[10] || 'monthly',
      createdAt: row[11] || new Date().toISOString(),
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
    // Incluir todos los gastos aceptados (tanto saldados como no saldados)
    // para calcular correctamente el balance
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
        isSettled: row[12] === 'true' || row[12] === true, // Columna 12 es isSettled
      }));

    let totalOwed = 0; // Lo que te deben (gastos donde eres owner y el partner aún no pagó)
    let totalReceived = 0; // Lo que debes (gastos donde eres partner y tú aún no pagaste)

    sharedExpenses.forEach(se => {
      if (se.ownerUserId === userId) {
        // Tú creaste el gasto
        // Te deben tu parte SOLO si el partner aún NO pagó (no está saldado)
        // Si está saldado, significa que el partner ya pagó, entonces no te deben nada
        if (!se.isSettled) {
          totalOwed += se.ownerAmount;
        }
      } else if (se.sharedWithUserId === userId) {
        // Te compartieron un gasto
        // Debes tu parte SOLO si tú aún NO pagaste
        // Nota: isSettled indica que la parte del otro usuario está saldada
        // Si eres partner y isSettled=true, significa que el owner marcó como saldado porque tú pagaste
        // Por lo tanto, si isSettled=true y eres partner, NO debes nada
        if (!se.isSettled) {
          totalReceived += se.partnerAmount;
        }
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
    
    const now = new Date().toISOString();
    const newIncome = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId,
      ...incomeData,
      createdAt: now,
    };
    
    
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
  // Validación ANTES de insertar nada: el backend es la autoridad final, no el frontend.
  // Si alguna condición falla acá, no se appendea ningún pago ni se toca currentBalance —
  // así no puede quedar una fila huérfana en CreditCardPayments.
  const userCards = await getCreditCardsByUser(userId);
  const targetCard = userCards.find(c => c.id === paymentData.creditCardId);
  if (!targetCard) {
    throw new Error('La tarjeta no existe o no pertenece al usuario.');
  }
  if (!Number.isFinite(paymentData.amount)) {
    throw new Error('El importe debe ser un número válido.');
  }
  if (paymentData.amount <= 0) {
    throw new Error('El importe debe ser mayor a $0.');
  }
  if (paymentData.amount > targetCard.currentBalance) {
    throw new Error('El importe no puede superar el saldo actual.');
  }

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

    // Actualizar el balance de la tarjeta (usa el saldo ya validado arriba, sin re-consultarlo)
    try {
      await updateCreditCard(paymentData.creditCardId, userId, {
        currentBalance: Math.max(0, targetCard.currentBalance - paymentData.amount),
      });
    } catch (err) {
    }

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
        dateFormat: (row[10] as PDFImportTemplate['dateFormat']) || undefined,
        amountDecimalSeparator: (row[11] as PDFImportTemplate['amountDecimalSeparator']) || undefined,
        amountThousandsSeparator: (row[12] as PDFImportTemplate['amountThousandsSeparator']) || undefined,
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
    
    return finalTemplate;
  } catch (error) {
    console.error('Error guardando smart template:', error);
    throw error;
  }
}

// ============================================================================
// OPERACIONES CRUD - SHARED GROUPS (Gastos Compartidos V2)
// ============================================================================
// Fase 1: solo persistencia + motor de balances puro (lib/sharedGroupBalances.ts).
// Convive en paralelo con SHARED_EXPENSES (el sistema 1:1 de más arriba, que
// NO se toca). Mismo patrón de creación perezosa de hoja que createSharedExpense:
// cada función "create" verifica/crea su propia hoja antes de escribir, en vez
// de depender de initializeSheets().

function rowToSharedGroup(row: string[]): SharedGroup {
  return {
    id: row[0],
    name: row[1],
    createdBy: row[2],
    createdAt: row[3] || new Date().toISOString(),
  };
}

function rowToSharedGroupMember(row: string[]): SharedGroupMember {
  return {
    id: row[0],
    groupId: row[1],
    userId: row[2] || undefined,
    name: row[3],
    email: row[4] || undefined,
    createdAt: row[5] || new Date().toISOString(),
  };
}

function rowToSharedGroupExpense(row: string[]): SharedGroupExpense {
  return {
    id: row[0],
    groupId: row[1],
    description: row[2],
    amount: parseFloat(row[3] || '0'),
    currency: (row[4] as 'pesos' | 'usd') || 'pesos',
    paidByMemberId: row[5],
    date: row[6],
    createdBy: row[7],
    createdAt: row[8] || new Date().toISOString(),
  };
}

function rowToSharedGroupSplit(row: string[]): SharedGroupSplit {
  return {
    id: row[0],
    expenseId: row[1],
    memberId: row[2],
    amount: parseFloat(row[3] || '0'),
  };
}

function rowToSharedGroupSettlement(row: string[]): SharedGroupSettlement {
  return {
    id: row[0],
    groupId: row[1],
    paidByMemberId: row[2],
    paidToMemberId: row[3],
    amount: parseFloat(row[4] || '0'),
    currency: (row[5] as 'pesos' | 'usd') || 'pesos',
    date: row[6],
    createdBy: row[7],
    createdAt: row[8] || new Date().toISOString(),
    notes: row[9] || undefined,
  };
}

function rowToSharedGroupInvitation(row: string[]): SharedGroupInvitation {
  return {
    id: row[0],
    groupId: row[1],
    memberId: row[2],
    invitedByUserId: row[3],
    targetEmail: row[4],
    status: (row[5] as SharedGroupInvitation['status']) || 'pending',
    tokenHash: row[6],
    createdAt: row[7] || new Date().toISOString(),
    respondedAt: row[8] || undefined,
  };
}

// ---------------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------------

/**
 * Crea un grupo y agrega automáticamente a su creador como miembro vinculado
 * (userId = quien crea el grupo). Son 2 escrituras secuenciales a hojas
 * distintas (SharedGroups, después SharedGroupMembers) — Google Sheets no
 * tiene transacciones reales entre hojas. Si la segunda escritura fallara, el
 * grupo quedaría sin ningún miembro (estado parcial); para minimizarlo, el
 * catch intenta borrar el grupo recién creado (compensación best-effort, NO
 * una transacción real) antes de relanzar el error original.
 */
export async function createSharedGroup(
  userId: string,
  data: { name: string; creatorName: string; creatorEmail?: string }
): Promise<{ group: SharedGroup; creatorMember: SharedGroupMember }> {
  if (!data.name || data.name.trim().length === 0) {
    throw new Error('El nombre del grupo no puede estar vacío');
  }
  if (!data.creatorName || data.creatorName.trim().length === 0) {
    throw new Error('Falta el nombre del creador para agregarlo como miembro');
  }

  await createSheetIfNotExists(SHEETS.SHARED_GROUPS, ['id', 'name', 'createdBy', 'createdAt']);
  await createSheetIfNotExists(SHEETS.SHARED_GROUP_MEMBERS, ['id', 'groupId', 'userId', 'name', 'email', 'createdAt']);

  const now = new Date().toISOString();
  const group: SharedGroup = {
    id: generateId(),
    name: data.name.trim(),
    createdBy: userId,
    createdAt: now,
  };

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEETS.SHARED_GROUPS}!A2`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [[group.id, group.name, group.createdBy, group.createdAt]],
    },
  });

  try {
    const creatorMember = await createSharedGroupMember(group.id, {
      userId,
      name: data.creatorName.trim(),
      email: data.creatorEmail,
    });
    return { group, creatorMember };
  } catch (error) {
    try {
      await deleteSharedGroup(group.id, userId);
    } catch (cleanupError) {
      console.error('Error limpiando grupo tras fallo al crear el miembro creador (queda huérfano, sin miembros):', cleanupError);
    }
    throw error;
  }
}

/**
 * Grupos donde el usuario es MIEMBRO VINCULADO actualmente
 * (SharedGroupMembers.userId === userId) — no alcanza con haber sido el
 * creador, porque otros usuarios registrados también pueden pertenecer al
 * grupo sin haberlo creado.
 */
export async function getSharedGroupsByUser(userId: string): Promise<SharedGroup[]> {
  const [membersExist, groupsExist] = await Promise.all([
    sheetExists(SHEETS.SHARED_GROUP_MEMBERS),
    sheetExists(SHEETS.SHARED_GROUPS),
  ]);
  if (!membersExist || !groupsExist) return [];

  const membersResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEETS.SHARED_GROUP_MEMBERS}!A2:F`,
  });
  const memberRows = membersResponse.data.values || [];
  const myGroupIds = new Set(memberRows.filter((row) => row[2] === userId).map((row) => row[1]));
  if (myGroupIds.size === 0) return [];

  const groupsResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEETS.SHARED_GROUPS}!A2:D`,
  });
  const groupRows = groupsResponse.data.values || [];

  return groupRows.filter((row) => myGroupIds.has(row[0])).map(rowToSharedGroup);
}

/**
 * Busca un grupo por id, sin validar membresía (eso queda para la capa de
 * API/permisos de una fase futura). Devuelve null si no existe.
 */
export async function getSharedGroupById(groupId: string): Promise<SharedGroup | null> {
  const exists = await sheetExists(SHEETS.SHARED_GROUPS);
  if (!exists) return null;

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEETS.SHARED_GROUPS}!A2:D`,
  });
  const rows = response.data.values || [];
  const row = rows.find((r) => r[0] === groupId);
  return row ? rowToSharedGroup(row) : null;
}

/** Solo el creador del grupo puede renombrarlo. */
export async function updateSharedGroup(
  groupId: string,
  userId: string,
  data: { name: string }
): Promise<SharedGroup> {
  if (!data.name || data.name.trim().length === 0) {
    throw new Error('El nombre del grupo no puede estar vacío');
  }

  const exists = await sheetExists(SHEETS.SHARED_GROUPS);
  if (!exists) throw new Error('Grupo no encontrado');

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEETS.SHARED_GROUPS}!A2:D`,
  });
  const rows = response.data.values || [];
  const rowIndex = rows.findIndex((row) => row[0] === groupId && row[2] === userId);
  if (rowIndex === -1) throw new Error('Grupo no encontrado o no tenés permisos para modificarlo');

  const newName = data.name.trim();
  const actualRowIndex = rowIndex + 2;

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEETS.SHARED_GROUPS}!B${actualRowIndex}`,
    valueInputOption: 'RAW',
    requestBody: { values: [[newName]] },
  });

  return { ...rowToSharedGroup(rows[rowIndex]), name: newName };
}

/**
 * Elimina la fila del grupo. NO elimina en cascada sus miembros, gastos,
 * splits ni settlements (riesgo documentado, ver informe de entrega). Solo
 * el creador puede eliminarlo.
 */
export async function deleteSharedGroup(groupId: string, userId: string): Promise<void> {
  const exists = await sheetExists(SHEETS.SHARED_GROUPS);
  if (!exists) throw new Error('Grupo no encontrado');

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEETS.SHARED_GROUPS}!A2:D`,
  });
  const rows = response.data.values || [];
  const rowIndex = rows.findIndex((row) => row[0] === groupId && row[2] === userId);
  if (rowIndex === -1) throw new Error('Grupo no encontrado o no tenés permisos para eliminarlo');

  const actualRowIndex = rowIndex + 2;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: await getSheetId(SHEETS.SHARED_GROUPS),
              dimension: 'ROWS',
              startIndex: actualRowIndex - 1,
              endIndex: actualRowIndex,
            },
          },
        },
      ],
    },
  });
}

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

export async function getSharedGroupMembers(groupId: string): Promise<SharedGroupMember[]> {
  const exists = await sheetExists(SHEETS.SHARED_GROUP_MEMBERS);
  if (!exists) return [];

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEETS.SHARED_GROUP_MEMBERS}!A2:F`,
  });
  const rows = response.data.values || [];
  return rows.filter((row) => row[1] === groupId).map(rowToSharedGroupMember);
}

/**
 * Agrega un miembro al grupo. `userId` es opcional: un miembro sin cuenta
 * FindIA ("shadow member") se agrega solo con `name`. No hay ninguna
 * búsqueda ni vinculación automática por email acá — eso queda para una fase
 * futura. Si se pasa `userId`, se rechaza si ese usuario ya es miembro.
 */
export async function createSharedGroupMember(
  groupId: string,
  data: { name: string; userId?: string; email?: string }
): Promise<SharedGroupMember> {
  if (!data.name || data.name.trim().length === 0) {
    throw new Error('El nombre del miembro no puede estar vacío');
  }

  await createSheetIfNotExists(SHEETS.SHARED_GROUP_MEMBERS, ['id', 'groupId', 'userId', 'name', 'email', 'createdAt']);

  if (data.userId) {
    const existingMembers = await getSharedGroupMembers(groupId);
    if (existingMembers.some((m) => m.userId === data.userId)) {
      throw new Error('Ese usuario ya es miembro del grupo');
    }
  }

  const now = new Date().toISOString();
  const member: SharedGroupMember = {
    id: generateId(),
    groupId,
    userId: data.userId || undefined,
    name: data.name.trim(),
    email: data.email || undefined,
    createdAt: now,
  };

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEETS.SHARED_GROUP_MEMBERS}!A2`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [[member.id, member.groupId, member.userId || '', member.name, member.email || '', member.createdAt]],
    },
  });

  return member;
}

export async function updateSharedGroupMember(
  memberId: string,
  data: { name?: string; userId?: string; email?: string }
): Promise<SharedGroupMember> {
  const exists = await sheetExists(SHEETS.SHARED_GROUP_MEMBERS);
  if (!exists) throw new Error('Miembro no encontrado');

  if (data.name !== undefined && data.name.trim().length === 0) {
    throw new Error('El nombre del miembro no puede estar vacío');
  }

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEETS.SHARED_GROUP_MEMBERS}!A2:F`,
  });
  const rows = response.data.values || [];
  const rowIndex = rows.findIndex((row) => row[0] === memberId);
  if (rowIndex === -1) throw new Error('Miembro no encontrado');

  const current = rowToSharedGroupMember(rows[rowIndex]);
  const updated: SharedGroupMember = {
    ...current,
    name: data.name !== undefined ? data.name.trim() : current.name,
    userId: data.userId !== undefined ? data.userId : current.userId,
    email: data.email !== undefined ? data.email : current.email,
  };

  const actualRowIndex = rowIndex + 2;
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEETS.SHARED_GROUP_MEMBERS}!C${actualRowIndex}:E${actualRowIndex}`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [[updated.userId || '', updated.name, updated.email || '']],
    },
  });

  return updated;
}

/**
 * Vincula un SharedGroupMember shadow ya existente a una cuenta real. Nunca
 * crea un member nuevo ni toca name/email — escribe EXCLUSIVAMENTE la
 * columna userId (C), y solo si hace falta. Es el único lugar de todo el
 * código donde un userId de member se escribe fuera del alta inicial
 * (createSharedGroupMember) — pensado para llamarse exclusivamente desde el
 * handler server-side de accept de una invitación (Fase 4.2), nunca desde
 * el endpoint público de edición de member, que sigue ignorando cualquier
 * userId que el cliente envíe (sin cambios).
 *
 * Idempotente y retry-safe: si el member ya está vinculado exactamente a
 * `userId`, no escribe nada (no-op) y devuelve el member tal cual — cubre
 * el reintento de un accept que falló después de linkear pero antes de
 * marcar la invitación como accepted. Si está vinculado a un userId
 * DISTINTO, nunca lo sobreescribe: lanza un error de conflicto. Siempre
 * relee la fila antes de escribir (no confía en un `member` cacheado que le
 * pase el caller), para no perder una vinculación concurrente.
 */
export async function linkSharedGroupMemberToUser(memberId: string, userId: string): Promise<SharedGroupMember> {
  const exists = await sheetExists(SHEETS.SHARED_GROUP_MEMBERS);
  if (!exists) throw new Error('Miembro no encontrado');

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEETS.SHARED_GROUP_MEMBERS}!A2:F`,
  });
  const rows = response.data.values || [];
  const rowIndex = rows.findIndex((row) => row[0] === memberId);
  if (rowIndex === -1) throw new Error('Miembro no encontrado');

  const current = rowToSharedGroupMember(rows[rowIndex]);

  if (current.userId === userId) {
    return current;
  }
  if (current.userId) {
    throw new Error('Este miembro ya está vinculado a otra cuenta');
  }

  const actualRowIndex = rowIndex + 2;
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEETS.SHARED_GROUP_MEMBERS}!C${actualRowIndex}`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [[userId]],
    },
  });

  return { ...current, userId };
}

/**
 * Elimina un miembro. NO verifica si tiene gastos, splits o settlements que
 * lo referencian — eliminarlo puede dejar esas filas apuntando a un memberId
 * inexistente (riesgo documentado; computeGroupBalances las ignora
 * defensivamente si eso llegara a pasar).
 */
export async function deleteSharedGroupMember(memberId: string): Promise<void> {
  const exists = await sheetExists(SHEETS.SHARED_GROUP_MEMBERS);
  if (!exists) throw new Error('Miembro no encontrado');

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEETS.SHARED_GROUP_MEMBERS}!A2:F`,
  });
  const rows = response.data.values || [];
  const rowIndex = rows.findIndex((row) => row[0] === memberId);
  if (rowIndex === -1) throw new Error('Miembro no encontrado');

  const actualRowIndex = rowIndex + 2;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: await getSheetId(SHEETS.SHARED_GROUP_MEMBERS),
              dimension: 'ROWS',
              startIndex: actualRowIndex - 1,
              endIndex: actualRowIndex,
            },
          },
        },
      ],
    },
  });
}

// ---------------------------------------------------------------------------
// Expenses + Splits
// ---------------------------------------------------------------------------

export async function getSharedGroupExpenses(groupId: string): Promise<SharedGroupExpense[]> {
  const exists = await sheetExists(SHEETS.SHARED_GROUP_EXPENSES);
  if (!exists) return [];

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEETS.SHARED_GROUP_EXPENSES}!A2:I`,
  });
  const rows = response.data.values || [];
  return rows.filter((row) => row[1] === groupId).map(rowToSharedGroupExpense);
}

/** Lee todos los splits de un conjunto de expenseIds en UNA sola lectura de
 * hoja (evita leer la hoja completa una vez por cada gasto en un loop). */
export async function getSharedGroupSplitsForExpenseIds(expenseIds: string[]): Promise<SharedGroupSplit[]> {
  if (expenseIds.length === 0) return [];
  const exists = await sheetExists(SHEETS.SHARED_GROUP_SPLITS);
  if (!exists) return [];

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEETS.SHARED_GROUP_SPLITS}!A2:D`,
  });
  const rows = response.data.values || [];
  const expenseIdSet = new Set(expenseIds);
  return rows.filter((row) => expenseIdSet.has(row[1])).map(rowToSharedGroupSplit);
}

export async function getSharedGroupSplits(expenseId: string): Promise<SharedGroupSplit[]> {
  return getSharedGroupSplitsForExpenseIds([expenseId]);
}

/** Crea las filas de splits para un expenseId ya existente, en un único
 * append (todas las filas de una sola vez, no una llamada por split). */
export async function createSharedGroupSplits(
  expenseId: string,
  splits: { memberId: string; amount: number }[]
): Promise<SharedGroupSplit[]> {
  await createSheetIfNotExists(SHEETS.SHARED_GROUP_SPLITS, ['id', 'expenseId', 'memberId', 'amount']);

  const created: SharedGroupSplit[] = splits.map((s) => ({
    id: generateId(),
    expenseId,
    memberId: s.memberId,
    amount: s.amount,
  }));

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEETS.SHARED_GROUP_SPLITS}!A2`,
    valueInputOption: 'RAW',
    requestBody: {
      values: created.map((s) => [s.id, s.expenseId, s.memberId, s.amount]),
    },
  });

  return created;
}

/** Borra todos los splits de un expenseId (de abajo hacia arriba, para no
 * desincronizar índices de fila entre borrados sucesivos en la misma hoja). */
export async function deleteSharedGroupSplits(expenseId: string): Promise<void> {
  const exists = await sheetExists(SHEETS.SHARED_GROUP_SPLITS);
  if (!exists) return;

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEETS.SHARED_GROUP_SPLITS}!A2:D`,
  });
  const rows = response.data.values || [];
  const rowIndexes = rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => row[1] === expenseId)
    .map(({ index }) => index + 2)
    .sort((a, b) => b - a);

  if (rowIndexes.length === 0) return;

  const sheetId = await getSheetId(SHEETS.SHARED_GROUP_SPLITS);
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: rowIndexes.map((actualRowIndex) => ({
        deleteDimension: {
          range: { sheetId, dimension: 'ROWS', startIndex: actualRowIndex - 1, endIndex: actualRowIndex },
        },
      })),
    },
  });
}

/** Borra solo la fila de SharedGroupExpenses, sin tocar splits — uso interno
 * exclusivo de la compensación de createSharedGroupExpense (ahí todavía no
 * hay splits que borrar: fue justamente su creación la que falló). */
async function deleteSharedGroupExpenseRowOnly(expenseId: string): Promise<void> {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEETS.SHARED_GROUP_EXPENSES}!A2:I`,
  });
  const rows = response.data.values || [];
  const rowIndex = rows.findIndex((row) => row[0] === expenseId);
  if (rowIndex === -1) return;

  const actualRowIndex = rowIndex + 2;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: await getSheetId(SHEETS.SHARED_GROUP_EXPENSES),
              dimension: 'ROWS',
              startIndex: actualRowIndex - 1,
              endIndex: actualRowIndex,
            },
          },
        },
      ],
    },
  });
}

/**
 * Crea un SharedGroupExpense junto con sus splits, tratando la operación como
 * una unidad lógica — aunque Google Sheets no tiene transacciones reales
 * entre hojas. Estrategia para minimizar el riesgo de estado parcial:
 *   1. Se valida TODO (monto, descripción, moneda, pagador y splits
 *      perteneciendo al grupo, suma exacta en centavos) ANTES de escribir
 *      una sola fila.
 *   2. Los N splits se escriben en un único append (una sola llamada a la
 *      API, no N llamadas), acotando la ventana de riesgo a 2 llamadas
 *      secuenciales (gasto, después splits).
 *   3. Si falla el append de splits después de haber creado el gasto, se
 *      intenta borrar el gasto recién creado (compensación best-effort, NO
 *      un rollback real) antes de relanzar el error original.
 * Si ese borrado de compensación también fallara, quedaría un
 * SharedGroupExpense sin ningún SharedGroupSplit asociado — una fila
 * huérfana detectable después (riesgo documentado, no resuelto con
 * infraestructura de transacciones en esta fase).
 */
export async function createSharedGroupExpense(
  groupId: string,
  userId: string,
  data: {
    description: string;
    amount: number;
    currency: 'pesos' | 'usd';
    paidByMemberId: string;
    date: string;
    splits: { memberId: string; amount: number }[];
  }
): Promise<{ expense: SharedGroupExpense; splits: SharedGroupSplit[] }> {
  const members = await getSharedGroupMembers(groupId);
  if (members.length === 0) {
    throw new Error('El grupo no tiene miembros — no se puede cargar un gasto');
  }
  const validMemberIds = members.map((m) => m.id);

  const validation = validateSharedGroupExpenseInput(
    {
      description: data.description,
      amount: data.amount,
      currency: data.currency,
      paidByMemberId: data.paidByMemberId,
      splits: data.splits,
    },
    validMemberIds
  );
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  if (!parseCivilDate(data.date)) {
    throw new Error('La fecha del gasto no es válida (se espera formato YYYY-MM-DD)');
  }

  await createSheetIfNotExists(SHEETS.SHARED_GROUP_EXPENSES, [
    'id', 'groupId', 'description', 'amount', 'currency', 'paidByMemberId', 'date', 'createdBy', 'createdAt',
  ]);

  const now = new Date().toISOString();
  const expense: SharedGroupExpense = {
    id: generateId(),
    groupId,
    description: data.description.trim(),
    amount: data.amount,
    currency: data.currency,
    paidByMemberId: data.paidByMemberId,
    date: data.date,
    createdBy: userId,
    createdAt: now,
  };

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEETS.SHARED_GROUP_EXPENSES}!A2`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [[
        expense.id, expense.groupId, expense.description, expense.amount, expense.currency,
        expense.paidByMemberId, expense.date, expense.createdBy, expense.createdAt,
      ]],
    },
  });

  try {
    const splits = await createSharedGroupSplits(expense.id, data.splits);
    return { expense, splits };
  } catch (error) {
    try {
      await deleteSharedGroupExpenseRowOnly(expense.id);
    } catch (cleanupError) {
      console.error('Error limpiando gasto tras fallo al crear los splits (queda huérfano, sin splits):', cleanupError);
    }
    throw error;
  }
}

/**
 * Actualiza los campos propios de un gasto. Si se cambia `amount`, es
 * OBLIGATORIO pasar también `splits` (con la nueva suma exacta) — nunca se
 * permite cambiar el monto sin revalidar/reescribir los splits, para no
 * romper el invariante suma(splits) === amount.
 */
export async function updateSharedGroupExpense(
  expenseId: string,
  userId: string,
  data: {
    description?: string;
    amount?: number;
    currency?: 'pesos' | 'usd';
    paidByMemberId?: string;
    date?: string;
    splits?: { memberId: string; amount: number }[];
  }
): Promise<SharedGroupExpense> {
  if (data.amount !== undefined && !data.splits) {
    throw new Error('Para cambiar el monto también hay que pasar los nuevos splits');
  }

  const exists = await sheetExists(SHEETS.SHARED_GROUP_EXPENSES);
  if (!exists) throw new Error('Gasto no encontrado');

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEETS.SHARED_GROUP_EXPENSES}!A2:I`,
  });
  const rows = response.data.values || [];
  const rowIndex = rows.findIndex((row) => row[0] === expenseId && row[7] === userId);
  if (rowIndex === -1) throw new Error('Gasto no encontrado o no tenés permisos para modificarlo');

  const current = rowToSharedGroupExpense(rows[rowIndex]);
  const updated: SharedGroupExpense = {
    ...current,
    description: data.description !== undefined ? data.description.trim() : current.description,
    amount: data.amount !== undefined ? data.amount : current.amount,
    currency: data.currency !== undefined ? data.currency : current.currency,
    paidByMemberId: data.paidByMemberId !== undefined ? data.paidByMemberId : current.paidByMemberId,
    date: data.date !== undefined ? data.date : current.date,
  };

  if (updated.description.trim().length === 0) {
    throw new Error('La descripción no puede estar vacía');
  }
  if (data.date !== undefined && !parseCivilDate(data.date)) {
    throw new Error('La fecha del gasto no es válida (se espera formato YYYY-MM-DD)');
  }

  const members = await getSharedGroupMembers(current.groupId);
  const validMemberIds = members.map((m) => m.id);

  if (data.splits) {
    const validation = validateSharedGroupExpenseInput(
      {
        description: updated.description,
        amount: updated.amount,
        currency: updated.currency,
        paidByMemberId: updated.paidByMemberId,
        splits: data.splits,
      },
      validMemberIds
    );
    if (!validation.valid) throw new Error(validation.error);
  } else if (!validMemberIds.includes(updated.paidByMemberId)) {
    throw new Error('El pagador debe ser un miembro del grupo');
  }

  const actualRowIndex = rowIndex + 2;
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEETS.SHARED_GROUP_EXPENSES}!C${actualRowIndex}:G${actualRowIndex}`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [[updated.description, updated.amount, updated.currency, updated.paidByMemberId, updated.date]],
    },
  });

  if (data.splits) {
    await deleteSharedGroupSplits(expenseId);
    await createSharedGroupSplits(expenseId, data.splits);
  }

  return updated;
}

/** Elimina el gasto y, en cascada, todos sus splits (un split sin su gasto no
 * tiene ningún significado por sí solo). */
export async function deleteSharedGroupExpense(expenseId: string, userId: string): Promise<void> {
  const exists = await sheetExists(SHEETS.SHARED_GROUP_EXPENSES);
  if (!exists) throw new Error('Gasto no encontrado');

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEETS.SHARED_GROUP_EXPENSES}!A2:I`,
  });
  const rows = response.data.values || [];
  const rowIndex = rows.findIndex((row) => row[0] === expenseId && row[7] === userId);
  if (rowIndex === -1) throw new Error('Gasto no encontrado o no tenés permisos para eliminarlo');

  await deleteSharedGroupSplits(expenseId);

  const actualRowIndex = rowIndex + 2;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: await getSheetId(SHEETS.SHARED_GROUP_EXPENSES),
              dimension: 'ROWS',
              startIndex: actualRowIndex - 1,
              endIndex: actualRowIndex,
            },
          },
        },
      ],
    },
  });
}

// ---------------------------------------------------------------------------
// Settlements
// ---------------------------------------------------------------------------

export async function getSharedGroupSettlements(groupId: string): Promise<SharedGroupSettlement[]> {
  const exists = await sheetExists(SHEETS.SHARED_GROUP_SETTLEMENTS);
  if (!exists) return [];

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEETS.SHARED_GROUP_SETTLEMENTS}!A2:J`,
  });
  const rows = response.data.values || [];
  return rows.filter((row) => row[1] === groupId).map(rowToSharedGroupSettlement);
}

/**
 * Registra un pago externo entre dos miembros del grupo (NO procesa dinero
 * real). Antes de escribir, recalcula el balance actual del grupo (gastos +
 * splits + settlements existentes, una sola lectura de cada hoja) y rechaza
 * el settlement si supera lo que el pagador efectivamente debe al receptor
 * en esa moneda — evita generar una deuda invertida por error de carga.
 */
export async function createSharedGroupSettlement(
  groupId: string,
  userId: string,
  data: {
    paidByMemberId: string;
    paidToMemberId: string;
    amount: number;
    currency: 'pesos' | 'usd';
    date: string;
    notes?: string;
  }
): Promise<SharedGroupSettlement> {
  if (!Number.isFinite(data.amount) || data.amount <= 0) {
    throw new Error('El monto del pago debe ser un número finito mayor a 0');
  }
  if (data.currency !== 'pesos' && data.currency !== 'usd') {
    throw new Error("La moneda debe ser 'pesos' o 'usd'");
  }
  if (data.paidByMemberId === data.paidToMemberId) {
    throw new Error('El pagador y el receptor del pago no pueden ser el mismo miembro');
  }
  if (!parseCivilDate(data.date)) {
    throw new Error('La fecha del pago no es válida (se espera formato YYYY-MM-DD)');
  }

  const members = await getSharedGroupMembers(groupId);
  const validMemberIds = members.map((m) => m.id);
  if (!validMemberIds.includes(data.paidByMemberId) || !validMemberIds.includes(data.paidToMemberId)) {
    throw new Error('El pagador y el receptor deben ser miembros del grupo');
  }

  const expenses = await getSharedGroupExpenses(groupId);
  const splits = await getSharedGroupSplitsForExpenseIds(expenses.map((e) => e.id));
  const existingSettlements = await getSharedGroupSettlements(groupId);

  const currentBalances = computeGroupBalances(
    members.map((m) => ({ id: m.id })),
    expenses.map((e) => ({ id: e.id, paidByMemberId: e.paidByMemberId, currency: e.currency })),
    splits.map((s) => ({ expenseId: s.expenseId, memberId: s.memberId, amount: s.amount })),
    existingSettlements.map((s) => ({
      paidByMemberId: s.paidByMemberId,
      paidToMemberId: s.paidToMemberId,
      amount: s.amount,
      currency: s.currency,
    }))
  );

  const validation = validateSettlementAgainstBalance(currentBalances, data);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  await createSheetIfNotExists(SHEETS.SHARED_GROUP_SETTLEMENTS, [
    'id', 'groupId', 'paidByMemberId', 'paidToMemberId', 'amount', 'currency', 'date', 'createdBy', 'createdAt', 'notes',
  ]);

  const now = new Date().toISOString();
  const settlement: SharedGroupSettlement = {
    id: generateId(),
    groupId,
    paidByMemberId: data.paidByMemberId,
    paidToMemberId: data.paidToMemberId,
    amount: data.amount,
    currency: data.currency,
    date: data.date,
    createdBy: userId,
    createdAt: now,
    notes: data.notes || undefined,
  };

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEETS.SHARED_GROUP_SETTLEMENTS}!A2`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [[
        settlement.id, settlement.groupId, settlement.paidByMemberId, settlement.paidToMemberId,
        settlement.amount, settlement.currency, settlement.date, settlement.createdBy, settlement.createdAt,
        settlement.notes || '',
      ]],
    },
  });

  return settlement;
}

/**
 * Actualiza un settlement. Si cambia algún campo financiero (amount,
 * currency, paidByMemberId o paidToMemberId), se revalida contra el balance
 * del grupo EXCLUYENDO el efecto de este mismo settlement (no el balance ya
 * neteado con él adentro) — para no autorrechazar un pago por su propio
 * efecto ya aplicado.
 */
export async function updateSharedGroupSettlement(
  settlementId: string,
  userId: string,
  data: {
    paidByMemberId?: string;
    paidToMemberId?: string;
    amount?: number;
    currency?: 'pesos' | 'usd';
    date?: string;
    notes?: string;
  }
): Promise<SharedGroupSettlement> {
  const exists = await sheetExists(SHEETS.SHARED_GROUP_SETTLEMENTS);
  if (!exists) throw new Error('Pago no encontrado');

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEETS.SHARED_GROUP_SETTLEMENTS}!A2:J`,
  });
  const rows = response.data.values || [];
  const rowIndex = rows.findIndex((row) => row[0] === settlementId && row[7] === userId);
  if (rowIndex === -1) throw new Error('Pago no encontrado o no tenés permisos para modificarlo');

  const current = rowToSharedGroupSettlement(rows[rowIndex]);
  const updated: SharedGroupSettlement = {
    ...current,
    paidByMemberId: data.paidByMemberId !== undefined ? data.paidByMemberId : current.paidByMemberId,
    paidToMemberId: data.paidToMemberId !== undefined ? data.paidToMemberId : current.paidToMemberId,
    amount: data.amount !== undefined ? data.amount : current.amount,
    currency: data.currency !== undefined ? data.currency : current.currency,
    date: data.date !== undefined ? data.date : current.date,
    notes: data.notes !== undefined ? data.notes : current.notes,
  };

  if (!Number.isFinite(updated.amount) || updated.amount <= 0) {
    throw new Error('El monto del pago debe ser un número finito mayor a 0');
  }
  if (updated.paidByMemberId === updated.paidToMemberId) {
    throw new Error('El pagador y el receptor del pago no pueden ser el mismo miembro');
  }
  if (data.date !== undefined && !parseCivilDate(data.date)) {
    throw new Error('La fecha del pago no es válida (se espera formato YYYY-MM-DD)');
  }

  const financialFieldsChanged =
    data.amount !== undefined ||
    data.currency !== undefined ||
    data.paidByMemberId !== undefined ||
    data.paidToMemberId !== undefined;

  if (financialFieldsChanged) {
    const members = await getSharedGroupMembers(current.groupId);
    const validMemberIds = members.map((m) => m.id);
    if (!validMemberIds.includes(updated.paidByMemberId) || !validMemberIds.includes(updated.paidToMemberId)) {
      throw new Error('El pagador y el receptor deben ser miembros del grupo');
    }

    const expenses = await getSharedGroupExpenses(current.groupId);
    const splits = await getSharedGroupSplitsForExpenseIds(expenses.map((e) => e.id));
    const otherSettlements = (await getSharedGroupSettlements(current.groupId)).filter((s) => s.id !== settlementId);

    const balancesWithoutThisSettlement = computeGroupBalances(
      members.map((m) => ({ id: m.id })),
      expenses.map((e) => ({ id: e.id, paidByMemberId: e.paidByMemberId, currency: e.currency })),
      splits.map((s) => ({ expenseId: s.expenseId, memberId: s.memberId, amount: s.amount })),
      otherSettlements.map((s) => ({
        paidByMemberId: s.paidByMemberId,
        paidToMemberId: s.paidToMemberId,
        amount: s.amount,
        currency: s.currency,
      }))
    );

    const validation = validateSettlementAgainstBalance(balancesWithoutThisSettlement, updated);
    if (!validation.valid) throw new Error(validation.error);
  }

  const actualRowIndex = rowIndex + 2;
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEETS.SHARED_GROUP_SETTLEMENTS}!C${actualRowIndex}:J${actualRowIndex}`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [[
        updated.paidByMemberId, updated.paidToMemberId, updated.amount, updated.currency,
        updated.date, updated.createdBy, updated.createdAt, updated.notes || '',
      ]],
    },
  });

  return updated;
}

/**
 * Elimina un settlement. NO revalida retroactivamente otros settlements
 * posteriores del mismo grupo (riesgo documentado: en un caso extremo, borrar
 * un pago viejo podría dejar un pago más nuevo matemáticamente "excedido"
 * respecto del balance recalculado — no se resuelve con infraestructura de
 * versionado en esta fase).
 */
export async function deleteSharedGroupSettlement(settlementId: string, userId: string): Promise<void> {
  const exists = await sheetExists(SHEETS.SHARED_GROUP_SETTLEMENTS);
  if (!exists) throw new Error('Pago no encontrado');

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEETS.SHARED_GROUP_SETTLEMENTS}!A2:J`,
  });
  const rows = response.data.values || [];
  const rowIndex = rows.findIndex((row) => row[0] === settlementId && row[7] === userId);
  if (rowIndex === -1) throw new Error('Pago no encontrado o no tenés permisos para eliminarlo');

  const actualRowIndex = rowIndex + 2;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: await getSheetId(SHEETS.SHARED_GROUP_SETTLEMENTS),
              dimension: 'ROWS',
              startIndex: actualRowIndex - 1,
              endIndex: actualRowIndex,
            },
          },
        },
      ],
    },
  });
}

// ============================================================================
// FASE 4.1 — Invitaciones de Gastos Compartidos V2: modelo + persistencia.
// Solo CRUD y validaciones de integridad de datos. Autorización (quién puede
// invitar/aceptar/rechazar/cancelar) y las reglas de negocio de duplicados
// (canCreateInvitation, en lib/sharedGroupInvitations.ts) quedan para la API
// de Fase 4.2 — nada de esto se enforce automáticamente acá salvo la
// integridad básica (que el grupo y el member existan) y la validez de la
// transición de estado, que es un invariante del propio dato, no un permiso.
// ============================================================================

/** Lee TODAS las invitaciones en una sola lectura — igual patrón que el resto
 * de Fase 1/2: nunca se lee esta hoja dentro de un loop por grupo. Las
 * funciones de abajo filtran en memoria a partir de esta única lectura. */
export async function getAllSharedGroupInvitations(): Promise<SharedGroupInvitation[]> {
  const exists = await sheetExists(SHEETS.SHARED_GROUP_INVITATIONS);
  if (!exists) return [];

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEETS.SHARED_GROUP_INVITATIONS}!A2:I`,
  });
  const rows = response.data.values || [];
  return rows.map(rowToSharedGroupInvitation);
}

export async function getSharedGroupInvitationById(invitationId: string): Promise<SharedGroupInvitation | null> {
  const invitations = await getAllSharedGroupInvitations();
  return invitations.find((inv) => inv.id === invitationId) || null;
}

export async function getSharedGroupInvitationsByGroup(groupId: string): Promise<SharedGroupInvitation[]> {
  const invitations = await getAllSharedGroupInvitations();
  return invitations.filter((inv) => inv.groupId === groupId);
}

/** Todas las invitaciones (cualquier status) de un member puntual dentro de
 * su grupo — insumo de canCreateInvitation() para detectar duplicados. */
export async function getSharedGroupInvitationsByMember(groupId: string, memberId: string): Promise<SharedGroupInvitation[]> {
  const invitations = await getAllSharedGroupInvitations();
  return invitations.filter((inv) => inv.groupId === groupId && inv.memberId === memberId);
}

export async function getSharedGroupInvitationsByTargetEmail(targetEmail: string): Promise<SharedGroupInvitation[]> {
  const normalized = normalizeInvitationEmail(targetEmail);
  const invitations = await getAllSharedGroupInvitations();
  return invitations.filter((inv) => inv.targetEmail === normalized);
}

/**
 * Invitaciones PENDING dirigidas a `targetEmail`, enriquecidas con
 * `groupName`/`inviterName` para que la UI pueda mostrar "Diego te invitó a
 * Casa" sin resolver nada del lado del cliente. Costo: 1 lectura
 * (invitations) +, solo si hay al menos una pending, 2 lecturas más
 * (SharedGroups y SharedGroupMembers completos, una sola vez cada una,
 * filtradas en memoria) — nunca "por cada invitación, leer su grupo/su
 * invitador" (mismo criterio anti-N+1 que getSharedGroupsSummaryForUser).
 */
export async function getSharedGroupInvitationsWithDetailsForTargetEmail(
  targetEmail: string
): Promise<SharedGroupInvitationWithDetails[]> {
  const invitations = await getSharedGroupInvitationsByTargetEmail(targetEmail);
  const pending = invitations.filter((inv) => inv.status === 'pending');
  if (pending.length === 0) return [];

  const [groupRows, memberRows] = await Promise.all([
    safeGetValues(`${SHEETS.SHARED_GROUPS}!A2:D`),
    safeGetValues(`${SHEETS.SHARED_GROUP_MEMBERS}!A2:F`),
  ]);
  const allGroups = groupRows.map(rowToSharedGroup);
  const allMembers = memberRows.map(rowToSharedGroupMember);

  return pending.map((inv) => {
    const group = allGroups.find((g) => g.id === inv.groupId);
    const inviterMember = allMembers.find((m) => m.groupId === inv.groupId && m.userId === inv.invitedByUserId);
    return {
      ...inv,
      groupName: group?.name || 'Grupo',
      inviterName: inviterMember?.name || 'Alguien',
    };
  });
}

/**
 * Crea una invitación `pending` para un member YA EXISTENTE — nunca crea el
 * member (eso sigue siendo responsabilidad exclusiva de
 * createSharedGroupMember, sin tocar acá). El token plano se genera y se
 * devuelve UNA sola vez, junto con la invitación: es la única función de
 * todo este módulo que tiene el token en texto plano en algún momento;
 * ninguna lectura posterior puede reconstruirlo, porque solo se persiste su
 * hash (`tokenHash`) — nunca se loggea el token en ningún punto de esta
 * función.
 *
 * NO valida acá si ya existe una invitación pending para el mismo member ni
 * si conviene bloquear por duplicado — esa decisión de negocio (409 o no)
 * queda para la API de Fase 4.2, apoyada en canCreateInvitation()/
 * getSharedGroupInvitationsByMember() de arriba. Acá solo se valida
 * integridad de datos: que el grupo y el member realmente existan y que el
 * member pertenezca a ese grupo.
 */
export async function createSharedGroupInvitation(
  groupId: string,
  memberId: string,
  invitedByUserId: string,
  targetEmail: string
): Promise<{ invitation: SharedGroupInvitation; token: string }> {
  const group = await getSharedGroupById(groupId);
  if (!group) throw new Error('Grupo no encontrado');

  const members = await getSharedGroupMembers(groupId);
  const member = members.find((m) => m.id === memberId);
  if (!member) throw new Error('El miembro no pertenece a este grupo');

  const normalizedEmail = normalizeInvitationEmail(targetEmail);
  if (!normalizedEmail) throw new Error('El email de la invitación es requerido');

  await createSheetIfNotExists(SHEETS.SHARED_GROUP_INVITATIONS, [
    'id', 'groupId', 'memberId', 'invitedByUserId', 'targetEmail', 'status', 'tokenHash', 'createdAt', 'respondedAt',
  ]);

  const token = generateInvitationToken();
  const tokenHash = hashInvitationToken(token);
  const now = new Date().toISOString();

  const invitation: SharedGroupInvitation = {
    id: generateId(),
    groupId,
    memberId,
    invitedByUserId,
    targetEmail: normalizedEmail,
    status: 'pending',
    tokenHash,
    createdAt: now,
  };

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEETS.SHARED_GROUP_INVITATIONS}!A2`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [[
        invitation.id, invitation.groupId, invitation.memberId, invitation.invitedByUserId,
        invitation.targetEmail, invitation.status, invitation.tokenHash, invitation.createdAt,
        invitation.respondedAt || '',
      ]],
    },
  });

  return { invitation, token };
}

/**
 * Aplica una transición de estado (pending -> accepted/rejected/cancelled)
 * a una invitación existente, validada con validateInvitationTransition
 * antes de escribir — nunca permite reabrir un estado terminal.
 *
 * NO valida quién puede aceptar/rechazar/cancelar (autorización — API de
 * Fase 4.2) ni vincula SharedGroupMember.userId: ese link es un paso
 * separado y explícito que hará el endpoint de accept en 4.2, llamando
 * PRIMERO a updateSharedGroupMember con el userId real y RECIÉN DESPUÉS a
 * esta función (ver informe: ese orden sobrevive mejor a una falla parcial
 * entre ambos writes — si el link al member ya se aplicó pero este segundo
 * write falla, un reintento de accept es seguro; al revés, dejaría la
 * invitación "aceptada" sin que el member tenga acceso real).
 */
export async function updateSharedGroupInvitation(
  invitationId: string,
  newStatus: SharedGroupInvitation['status']
): Promise<SharedGroupInvitation> {
  const exists = await sheetExists(SHEETS.SHARED_GROUP_INVITATIONS);
  if (!exists) throw new Error('Invitación no encontrada');

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEETS.SHARED_GROUP_INVITATIONS}!A2:I`,
  });
  const rows = response.data.values || [];
  const rowIndex = rows.findIndex((row) => row[0] === invitationId);
  if (rowIndex === -1) throw new Error('Invitación no encontrada');

  const current = rowToSharedGroupInvitation(rows[rowIndex]);
  const transition = validateInvitationTransition(current.status, newStatus);
  if (!transition.valid) throw new Error(transition.error);

  const respondedAt = new Date().toISOString();
  const updated: SharedGroupInvitation = { ...current, status: newStatus, respondedAt };

  const actualRowIndex = rowIndex + 2;
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEETS.SHARED_GROUP_INVITATIONS}!F${actualRowIndex}:I${actualRowIndex}`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [[updated.status, updated.tokenHash, updated.createdAt, updated.respondedAt || '']],
    },
  });

  return updated;
}

/**
 * Borrado FÍSICO de una invitación — pensado para cascada administrativa
 * (ej. si más adelante se borra el member al que apunta) o limpieza, NO
 * para el flujo normal de "cancelar" (eso es
 * updateSharedGroupInvitation(id, 'cancelled'), que preserva el historial
 * en vez de borrar la fila). Silenciosamente no hace nada si la hoja o la
 * fila no existen — pensado para poder llamarse desde una cascada sin tener
 * que verificar antes si hay algo que borrar.
 */
export async function deleteSharedGroupInvitation(invitationId: string): Promise<void> {
  const exists = await sheetExists(SHEETS.SHARED_GROUP_INVITATIONS);
  if (!exists) return;

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEETS.SHARED_GROUP_INVITATIONS}!A2:I`,
  });
  const rows = response.data.values || [];
  const rowIndex = rows.findIndex((row) => row[0] === invitationId);
  if (rowIndex === -1) return;

  const actualRowIndex = rowIndex + 2;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: await getSheetId(SHEETS.SHARED_GROUP_INVITATIONS),
              dimension: 'ROWS',
              startIndex: actualRowIndex - 1,
              endIndex: actualRowIndex,
            },
          },
        },
      ],
    },
  });
}

// ============================================================================
// FASE 2 — helpers de autorización, integridad y agregación para las API
// routes de Gastos Compartidos V2. NINGUNA función de Fase 1 de arriba se
// modifica; esto solo agrega funciones nuevas que las reutilizan.
// ============================================================================

/**
 * Resuelve la membresía vinculada del usuario autenticado en un grupo.
 * Única fuente de verdad para "pertenece al grupo": busca por
 * SharedGroupMember.userId — NUNCA por email — así que un shadow member
 * (sin userId) nunca puede matchear un usuario autenticado.
 */
export async function getSharedGroupMemberForUser(groupId: string, userId: string): Promise<SharedGroupMember | null> {
  const members = await getSharedGroupMembers(groupId);
  return members.find((m) => m.userId === userId) || null;
}

/** Lee members + expenses + splits + settlements de un grupo en 4 lecturas
 * totales — el insumo listo para computeGroupBalances /
 * findFirstSettlementBrokenByReplay sin leer ninguna hoja más de una vez. */
export async function getSharedGroupBalanceInputs(groupId: string): Promise<{
  members: SharedGroupMember[];
  expenses: SharedGroupExpense[];
  splits: SharedGroupSplit[];
  settlements: SharedGroupSettlement[];
}> {
  const members = await getSharedGroupMembers(groupId);
  const expenses = await getSharedGroupExpenses(groupId);
  const splits = await getSharedGroupSplitsForExpenseIds(expenses.map((e) => e.id));
  const settlements = await getSharedGroupSettlements(groupId);
  return { members, expenses, splits, settlements };
}

/**
 * Chequea si un miembro está referenciado por algún gasto, split o
 * settlement de su propio grupo (paidByMemberId, split.memberId,
 * paidByMemberId/paidToMemberId de settlements). 3 lecturas (expenses,
 * splits, settlements) — se usa para bloquear el borrado de un miembro con
 * movimientos asociados, en vez de dejar filas huérfanas.
 */
export async function isSharedGroupMemberReferenced(groupId: string, memberId: string): Promise<boolean> {
  const expenses = await getSharedGroupExpenses(groupId);
  if (expenses.some((e) => e.paidByMemberId === memberId)) return true;

  const splits = await getSharedGroupSplitsForExpenseIds(expenses.map((e) => e.id));
  if (splits.some((s) => s.memberId === memberId)) return true;

  const settlements = await getSharedGroupSettlements(groupId);
  if (settlements.some((s) => s.paidByMemberId === memberId || s.paidToMemberId === memberId)) return true;

  return false;
}

/** Borra todas las filas de `sheetName` cuya columna `matchColumnIndex` sea
 * exactamente `matchValue`, en un único batchUpdate. Devuelve los ids
 * (columna 0) de las filas borradas — útil para encadenar (ej. expenseIds
 * borrados, para después borrar sus splits). Uso interno de
 * deleteSharedGroupCascade. */
async function deleteRowsMatching(sheetName: string, matchColumnIndex: number, matchValue: string, range: string): Promise<string[]> {
  const exists = await sheetExists(sheetName);
  if (!exists) return [];
  const response = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${sheetName}!${range}` });
  const rows = response.data.values || [];
  const matches = rows.map((row, index) => ({ row, index })).filter(({ row }) => row[matchColumnIndex] === matchValue);
  if (matches.length === 0) return [];

  const sheetId = await getSheetId(sheetName);
  const rowIndexesDesc = matches.map(({ index }) => index + 2).sort((a, b) => b - a);
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: rowIndexesDesc.map((actualRowIndex) => ({
        deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex: actualRowIndex - 1, endIndex: actualRowIndex } },
      })),
    },
  });
  return matches.map(({ row }) => row[0]);
}

/** Igual que deleteRowsMatching pero contra un CONJUNTO de valores posibles
 * (ej. borrar los splits de N expenseIds a la vez, en una sola lectura). */
async function deleteRowsMatchingAny(sheetName: string, matchColumnIndex: number, matchValues: string[], range: string): Promise<void> {
  if (matchValues.length === 0) return;
  const exists = await sheetExists(sheetName);
  if (!exists) return;
  const response = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${sheetName}!${range}` });
  const rows = response.data.values || [];
  const valueSet = new Set(matchValues);
  const matches = rows.map((row, index) => ({ row, index })).filter(({ row }) => valueSet.has(row[matchColumnIndex]));
  if (matches.length === 0) return;

  const sheetId = await getSheetId(sheetName);
  const rowIndexesDesc = matches.map(({ index }) => index + 2).sort((a, b) => b - a);
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: rowIndexesDesc.map((actualRowIndex) => ({
        deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex: actualRowIndex - 1, endIndex: actualRowIndex } },
      })),
    },
  });
}

/**
 * Borra un grupo completo en cascada: splits -> expenses -> settlements ->
 * members -> group. Solo el creador puede ejecutarlo (lanza Error si no).
 * Google Sheets no tiene transacciones reales entre hojas: si un paso
 * intermedio falla, la operación queda parcialmente aplicada y el error se
 * relanza tal cual — no se intenta revertir lo ya borrado (no es factible de
 * forma segura sin una transacción real; ver informe de entrega). Lee cada
 * hoja involucrada exactamente una vez.
 */
export async function deleteSharedGroupCascade(groupId: string, userId: string): Promise<void> {
  const group = await getSharedGroupById(groupId);
  if (!group) throw new Error('Grupo no encontrado');
  if (group.createdBy !== userId) throw new Error('Solo el creador del grupo puede eliminarlo');

  const expenseIds = await deleteRowsMatching(SHEETS.SHARED_GROUP_EXPENSES, 1, groupId, 'A2:I');
  await deleteRowsMatchingAny(SHEETS.SHARED_GROUP_SPLITS, 1, expenseIds, 'A2:D');
  await deleteRowsMatching(SHEETS.SHARED_GROUP_SETTLEMENTS, 1, groupId, 'A2:J');
  await deleteRowsMatching(SHEETS.SHARED_GROUP_MEMBERS, 1, groupId, 'A2:F');
  await deleteRowsMatching(SHEETS.SHARED_GROUPS, 0, groupId, 'A2:D');
}

async function safeGetValues(range: string): Promise<string[][]> {
  try {
    const resp = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range });
    return (resp.data.values || []) as string[][];
  } catch (error) {
    // Solo "el rango/hoja no existe todavía" es seguro tratar como vacío.
    // Cualquier otro error (429, 5xx, auth) se relanza — antes se atrapaba
    // todo por igual, lo que enmascaraba un 429 real como "sin datos".
    if (isGoogleSheetsNotFoundError(error)) return [];
    throw error;
  }
}

/**
 * Resumen de TODOS los grupos donde el usuario es miembro vinculado, cada
 * uno con su balance ya calculado — en exactamente 5 lecturas TOTALES (una
 * por hoja V2), sin importar cuántos grupos tenga el usuario. La alternativa
 * ingenua ("por cada grupo, leer y calcular su balance") escala linealmente
 * con la cantidad de grupos y fue explícitamente la causa del 429 real
 * detectado en Fase 1 — se evita a propósito acá agregando todo en memoria
 * después de leer cada hoja una sola vez.
 */
export async function getSharedGroupsSummaryForUser(userId: string): Promise<Array<{
  group: SharedGroup;
  myMemberId: string;
  balances: SharedGroupPairBalance[];
  // Fase 3 (frontend): id+name de cada miembro, para que la lista de grupos
  // pueda mostrar "Ana te debe $X" y la cantidad de personas SIN pedir
  // /members por cada grupo (evita el N+1 que causó el 429 real).
  members: Array<{ id: string; name: string }>;
}>> {
  const [groupRows, memberRows, expenseRows, splitRows, settlementRows] = await Promise.all([
    safeGetValues(`${SHEETS.SHARED_GROUPS}!A2:D`),
    safeGetValues(`${SHEETS.SHARED_GROUP_MEMBERS}!A2:F`),
    safeGetValues(`${SHEETS.SHARED_GROUP_EXPENSES}!A2:I`),
    safeGetValues(`${SHEETS.SHARED_GROUP_SPLITS}!A2:D`),
    safeGetValues(`${SHEETS.SHARED_GROUP_SETTLEMENTS}!A2:J`),
  ]);

  const allMembers = memberRows.map(rowToSharedGroupMember);
  const myMemberships = allMembers.filter((m) => m.userId === userId);
  if (myMemberships.length === 0) return [];

  const allGroups = groupRows.map(rowToSharedGroup);
  const allExpenses = expenseRows.map(rowToSharedGroupExpense);
  const allSplits = splitRows.map(rowToSharedGroupSplit);
  const allSettlements = settlementRows.map(rowToSharedGroupSettlement);

  const summaries: Array<{
    group: SharedGroup;
    myMemberId: string;
    balances: SharedGroupPairBalance[];
    members: Array<{ id: string; name: string }>;
  }> = [];

  for (const membership of myMemberships) {
    const group = allGroups.find((g) => g.id === membership.groupId);
    if (!group) continue; // membresía huérfana (grupo borrado sin cascada en algún momento anterior a Fase 2): se ignora

    const groupMembers = allMembers.filter((m) => m.groupId === group.id);
    const groupExpenses = allExpenses.filter((e) => e.groupId === group.id);
    const groupExpenseIds = new Set(groupExpenses.map((e) => e.id));
    const groupSplits = allSplits.filter((s) => groupExpenseIds.has(s.expenseId));
    const groupSettlements = allSettlements.filter((s) => s.groupId === group.id);

    const balances = computeGroupBalances(
      groupMembers.map((m) => ({ id: m.id })),
      groupExpenses.map((e) => ({ id: e.id, paidByMemberId: e.paidByMemberId, currency: e.currency })),
      groupSplits.map((s) => ({ expenseId: s.expenseId, memberId: s.memberId, amount: s.amount })),
      groupSettlements.map((s) => ({
        paidByMemberId: s.paidByMemberId,
        paidToMemberId: s.paidToMemberId,
        amount: s.amount,
        currency: s.currency,
      }))
    );

    summaries.push({
      group,
      myMemberId: membership.id,
      balances,
      members: groupMembers.map((m) => ({ id: m.id, name: m.name })),
    });
  }

  return summaries;
}
