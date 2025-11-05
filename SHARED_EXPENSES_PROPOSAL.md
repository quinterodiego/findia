# 💰 Propuesta: Sistema de Gastos Compartidos

## 🎯 Objetivo
Permitir que dos usuarios (parejas, amigos, roommates) compartan gastos y los dividan automáticamente (50/50 por defecto, con opciones personalizadas).

## 📊 Modelo de Datos

### Estructura en Google Sheets

**Hoja: SHARED_EXPENSES**
```
A: id (UUID)
B: expenseId (ID del gasto original)
C: ownerUserId (quien creó el gasto)
D: sharedWithUserId (con quién se comparte)
E: splitType ('equal' | 'percentage' | 'amount')
F: ownerAmount (porción del dueño)
G: partnerAmount (porción del compañero)
H: status ('pending' | 'accepted' | 'rejected')
I: createdAt
J: acceptedAt
K: notes
```

**Modificaciones a EXPENSES:**
- Agregar columna: `isShared` (boolean)
- Agregar columna: `sharedExpenseId` (opcional, referencia)

### Interfaces TypeScript

```typescript
interface SharedExpense {
  id: string
  expenseId: string
  ownerUserId: string
  sharedWithUserId: string
  splitType: 'equal' | 'percentage' | 'amount'
  ownerAmount: number
  partnerAmount: number
  status: 'pending' | 'accepted' | 'rejected'
  createdAt: string
  acceptedAt?: string
  notes?: string
  // Relaciones
  expense?: Expense
  owner?: User
  partner?: User
}

interface Expense {
  // ... campos existentes
  isShared?: boolean
  sharedExpenseId?: string
}
```

## 🚀 Funcionalidades

### 1. **Compartir un Gasto**
- Botón "🔄 Compartir" en cada gasto del dashboard
- Modal para:
  - Buscar usuario por email
  - Seleccionar tipo de división:
    - **50/50** (por defecto)
    - **Porcentaje** (ej: 70/30)
    - **Monto exacto** (ej: $5000 / $3000)
  - Agregar notas opcionales
- Enviar notificación al compañero

### 2. **Aceptar/Rechazar Gastos Compartidos**
- Sección "Gastos Compartidos Pendientes" en dashboard
- Badge con contador de pendientes
- Vista de gastos compartidos:
  - **Recibidos**: Gastos que otros compartieron contigo
  - **Enviados**: Gastos que tú compartiste
- Botones: Aceptar / Rechazar

### 3. **Vista Consolidada**
- Sección "Gastos Compartidos" en dashboard
- Filtros:
  - Todos
  - Solo recibidos
  - Solo enviados
  - Pendientes
  - Aceptados
- Mostrar:
  - Descripción del gasto
  - Quién lo pagó originalmente
  - División (ej: "Tu parte: $2,500")
  - Estado
  - Fecha

### 4. **Cálculo Automático**
- Cuando se acepta un gasto compartido:
  - **50/50**: Se divide el monto total entre 2
  - **Porcentaje**: Se calcula según porcentajes (ej: 70% = $7,000 de $10,000)
  - **Monto exacto**: Se usa el monto especificado
- El gasto aparece en ambos dashboards con su porción correspondiente

### 5. **Estadísticas**
- Total de gastos compartidos del mes
- Balance: "Te deben $X" o "Debes $X"
- Gráfico de gastos compartidos vs individuales

## 🎨 UI/UX

### Componentes Nuevos

1. **ShareExpenseModal**
   - Búsqueda de usuario por email
   - Selector de tipo de división
   - Preview del cálculo
   - Botón "Compartir"

2. **SharedExpensesSection**
   - Lista de gastos compartidos
   - Filtros y ordenamiento
   - Badges de estado

3. **SharedExpenseCard**
   - Información del gasto
   - División visual
   - Botones de acción

4. **PendingSharedExpensesBadge**
   - Badge con contador en navbar
   - Dropdown con lista rápida

### Indicadores Visuales

- 🔄 Badge "Compartido" en gastos compartidos
- ⏳ Badge "Pendiente" en gastos no aceptados
- ✅ Badge "Aceptado" en gastos confirmados
- 💰 Indicador de balance (verde/rojo)

## 📝 Flujo de Usuario

### Escenario 1: Compartir un Gasto Existente

1. Usuario A ve un gasto de $10,000 en su dashboard
2. Clic en "🔄 Compartir"
3. Busca a Usuario B por email
4. Selecciona "50/50"
5. Envía invitación
6. **Usuario B** recibe notificación
7. Usuario B acepta
8. **Ambos usuarios** ven:
   - Usuario A: "Gasto compartido: $10,000 (Tu parte: $5,000)"
   - Usuario B: "Gasto compartido: $10,000 (Tu parte: $5,000)"

### Escenario 2: División Personalizada

1. Usuario A comparte gasto de $10,000
2. Selecciona "Porcentaje: 70/30"
3. Usuario B acepta
4. **Resultado**:
   - Usuario A: $7,000
   - Usuario B: $3,000

## 🔧 API Endpoints

```
POST /api/shared-expenses
  - Crear gasto compartido
  - Body: { expenseId, sharedWithUserId, splitType, ownerAmount?, partnerAmount?, notes? }

GET /api/shared-expenses
  - Obtener todos los gastos compartidos del usuario
  - Query params: ?status=pending&type=received

PUT /api/shared-expenses/[id]/accept
  - Aceptar gasto compartido

PUT /api/shared-expenses/[id]/reject
  - Rechazar gasto compartido

DELETE /api/shared-expenses/[id]
  - Cancelar gasto compartido (solo el dueño)

GET /api/shared-expenses/balance
  - Obtener balance de gastos compartidos
  - Retorna: { totalOwed, totalReceived, balance }
```

## 🗄️ Funciones en googleSheets.ts

```typescript
// Crear gasto compartido
createSharedExpense(data: SharedExpenseData): Promise<SharedExpense>

// Obtener gastos compartidos del usuario
getSharedExpensesByUser(userId: string, filters?: SharedExpenseFilters): Promise<SharedExpense[]>

// Aceptar gasto compartido
acceptSharedExpense(sharedExpenseId: string, userId: string): Promise<void>

// Rechazar gasto compartido
rejectSharedExpense(sharedExpenseId: string, userId: string): Promise<void>

// Calcular balance
calculateSharedExpenseBalance(userId: string): Promise<Balance>
```

## 🎯 Próximos Pasos

1. ✅ Crear estructura de datos en Google Sheets
2. ✅ Implementar funciones en `googleSheets.ts`
3. ✅ Crear API endpoints
4. ✅ Crear componentes UI
5. ✅ Integrar en dashboard
6. ✅ Agregar notificaciones
7. ✅ Testing y refinamiento

## 💡 Mejoras Futuras

- **Grupos**: Compartir gastos entre 3+ personas
- **Recordatorios**: Notificar cuando hay gastos pendientes
- **Historial**: Ver historial de gastos compartidos
- **Exportar**: Exportar reporte de gastos compartidos
- **Integración con pagos**: Marcar cuando se pagó la parte del compañero

