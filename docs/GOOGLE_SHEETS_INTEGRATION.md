# 📊 Integración de Google Sheets API

## 🎯 Descripción General

FindIA utiliza **Google Sheets** como base de datos para almacenar deudas, pagos y usuarios. Esta integración proporciona persistencia de datos sin necesidad de una base de datos tradicional.

---

## 📁 Estructura de Archivos

```
findia/
├── lib/
│   └── googleSheets.ts          # Funciones de Google Sheets API
├── hooks/
│   └── useDebts.ts              # Hook personalizado para usar la API
├── app/api/
│   ├── debts/
│   │   ├── route.ts             # GET, POST, PUT (init)
│   │   └── [id]/
│   │       ├── route.ts         # GET, PUT, DELETE
│   │       └── payments/
│   │           └── route.ts     # GET, POST
│   └── stats/
│       └── route.ts             # GET estadísticas
└── types/
    └── index.ts                 # TypeScript interfaces
```

---

## 🔧 Configuración Inicial

### 1. Variables de Entorno

En tu archivo `.env`:

```env
# Google Sheets API
GOOGLE_SHEETS_ID=1lH_B8rkigbGjfhIN1vHt7Nwo6kMJW7mE3_cTY7DqcYQ
GOOGLE_SERVICE_ACCOUNT_EMAIL=findia@findia-475412.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Admin Users (para inicializar hojas)
ADMIN_EMAILS=d86webs@gmail.com,coderflixarg@gmail.com
```

### 2. Estructura del Spreadsheet

El spreadsheet debe tener **3 hojas** con los siguientes nombres y columnas:

#### Hoja: `Debts`
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | string | ID único de la deuda |
| userId | string | ID del usuario propietario |
| name | string | Nombre de la deuda |
| amount | number | Monto original |
| balance | number | Saldo actual |
| interestRate | number | Tasa de interés (%) |
| minPayment | number | Pago mínimo mensual |
| dueDate | string | Fecha de vencimiento (ISO) |
| priority | string | `high`, `medium`, `low` |
| status | string | `active`, `paid`, `overdue` |
| category | string | Categoría de la deuda |
| notes | string | Notas adicionales |
| createdAt | string | Fecha de creación (ISO) |
| updatedAt | string | Fecha de actualización (ISO) |

#### Hoja: `Payments`
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | string | ID único del pago |
| debtId | string | ID de la deuda asociada |
| userId | string | ID del usuario |
| amount | number | Monto del pago |
| date | string | Fecha del pago (ISO) |
| type | string | `regular`, `extra`, `minimum` |
| notes | string | Notas del pago |
| createdAt | string | Fecha de registro (ISO) |

#### Hoja: `Users`
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | string | ID único del usuario |
| email | string | Email del usuario |
| name | string | Nombre del usuario |
| image | string | URL de la imagen de perfil |
| createdAt | string | Fecha de registro (ISO) |
| lastLogin | string | Último inicio de sesión (ISO) |

---

## 🚀 Inicialización del Spreadsheet

### Opción 1: Automática (Recomendado)

Si eres **admin**, puedes inicializar las hojas automáticamente:

```typescript
const { initializeSheets } = useDebts();

await initializeSheets();
```

Esto creará las 3 hojas con sus encabezados si no existen.

### Opción 2: Manual

Crea manualmente las hojas en Google Sheets con los nombres exactos:
- `Debts`
- `Payments`
- `Users`

Y copia los encabezados de las tablas anteriores en la primera fila.

---

## 📚 Uso del Hook `useDebts`

### Importar el Hook

```typescript
import { useDebts } from '@/hooks/useDebts';
```

### Ejemplo Completo

```typescript
'use client';

import { useEffect } from 'react';
import { useDebts } from '@/hooks/useDebts';

export default function DebtsPage() {
  const {
    debts,
    stats,
    loading,
    error,
    fetchDebts,
    fetchStats,
    createDebt,
    updateDebt,
    deleteDebt,
    makePayment,
  } = useDebts();

  // Cargar datos al montar el componente
  useEffect(() => {
    fetchDebts();
    fetchStats();
  }, [fetchDebts, fetchStats]);

  // Crear nueva deuda
  const handleCreateDebt = async () => {
    try {
      await createDebt({
        name: 'Tarjeta de Crédito',
        amount: 5000,
        balance: 5000,
        interestRate: 18.5,
        minPayment: 250,
        dueDate: '2025-12-31',
        priority: 'high',
        category: 'credit_card',
      });
      console.log('✅ Deuda creada');
    } catch (err) {
      console.error('❌ Error:', err);
    }
  };

  // Registrar pago
  const handleMakePayment = async (debtId: string) => {
    try {
      await makePayment(debtId, {
        amount: 500,
        date: new Date().toISOString(),
        type: 'regular',
        notes: 'Pago mensual',
      });
      console.log('✅ Pago registrado');
    } catch (err) {
      console.error('❌ Error:', err);
    }
  };

  // Actualizar deuda
  const handleUpdateDebt = async (debtId: string) => {
    try {
      await updateDebt(debtId, {
        priority: 'low',
        notes: 'Actualizado',
      });
      console.log('✅ Deuda actualizada');
    } catch (err) {
      console.error('❌ Error:', err);
    }
  };

  // Eliminar deuda
  const handleDeleteDebt = async (debtId: string) => {
    try {
      await deleteDebt(debtId);
      console.log('✅ Deuda eliminada');
    } catch (err) {
      console.error('❌ Error:', err);
    }
  };

  if (loading) return <div>Cargando...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h1>Mis Deudas</h1>
      
      {/* Estadísticas */}
      {stats && (
        <div>
          <p>Total Deuda: ${stats.totalDebt.toFixed(2)}</p>
          <p>Saldo: ${stats.totalBalance.toFixed(2)}</p>
          <p>Pagado: ${stats.totalPaid.toFixed(2)}</p>
          <p>Progreso: {stats.progress.toFixed(1)}%</p>
        </div>
      )}

      {/* Lista de deudas */}
      <ul>
        {debts.map(debt => (
          <li key={debt.id}>
            <h3>{debt.name}</h3>
            <p>Saldo: ${debt.balance.toFixed(2)}</p>
            <button onClick={() => handleMakePayment(debt.id)}>
              Registrar Pago
            </button>
            <button onClick={() => handleUpdateDebt(debt.id)}>
              Actualizar
            </button>
            <button onClick={() => handleDeleteDebt(debt.id)}>
              Eliminar
            </button>
          </li>
        ))}
      </ul>

      <button onClick={handleCreateDebt}>
        Crear Nueva Deuda
      </button>
    </div>
  );
}
```

---

## 🔌 API Endpoints

### 1. **GET /api/debts**
Obtiene todas las deudas del usuario autenticado.

**Response:**
```json
{
  "success": true,
  "debts": [
    {
      "id": "...",
      "userId": "...",
      "name": "Tarjeta Visa",
      "amount": 5000,
      "balance": 3500,
      "interestRate": 18.5,
      "minPayment": 250,
      "dueDate": "2025-12-31",
      "priority": "high",
      "status": "active",
      "category": "credit_card",
      "notes": "",
      "createdAt": "2025-01-15T10:00:00Z",
      "updatedAt": "2025-01-20T15:30:00Z"
    }
  ]
}
```

### 2. **POST /api/debts**
Crea una nueva deuda.

**Body:**
```json
{
  "name": "Préstamo Personal",
  "amount": 10000,
  "balance": 10000,
  "interestRate": 12,
  "minPayment": 500,
  "dueDate": "2026-12-31",
  "priority": "medium",
  "category": "loan"
}
```

### 3. **PUT /api/debts**
Inicializa las hojas de Google Sheets (solo admin).

### 4. **GET /api/debts/[id]**
Obtiene una deuda específica.

### 5. **PUT /api/debts/[id]**
Actualiza una deuda.

**Body:**
```json
{
  "balance": 3000,
  "priority": "low",
  "notes": "Negociado descuento"
}
```

### 6. **DELETE /api/debts/[id]**
Elimina una deuda.

### 7. **POST /api/debts/[id]/payments**
Registra un pago para una deuda.

**Body:**
```json
{
  "amount": 500,
  "date": "2025-01-20T10:00:00Z",
  "type": "regular",
  "notes": "Pago mensual de enero"
}
```

**Nota:** Al registrar un pago, el `balance` de la deuda se actualiza automáticamente.

### 8. **GET /api/debts/[id]/payments**
Obtiene todos los pagos de una deuda.

### 9. **GET /api/stats**
Obtiene estadísticas del usuario.

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalDebt": 15000,
    "totalBalance": 10500,
    "totalPaid": 4500,
    "progress": 30,
    "activeDebts": 3,
    "paidDebts": 1,
    "overdueDebts": 0,
    "monthlyMinPayment": 750,
    "totalPaidThisMonth": 1500,
    "paymentsThisMonth": 3
  }
}
```

---

## ⚡ Funciones Principales

### `lib/googleSheets.ts`

| Función | Descripción |
|---------|-------------|
| `initializeSheets()` | Crea las hojas si no existen |
| `getDebtsByUser(userId)` | Obtiene deudas de un usuario |
| `getDebtById(debtId, userId)` | Obtiene una deuda específica |
| `createDebt(userId, debtData)` | Crea nueva deuda |
| `updateDebt(debtId, userId, updates)` | Actualiza deuda |
| `deleteDebt(debtId, userId)` | Elimina deuda |
| `getPaymentsByDebt(debtId)` | Obtiene pagos de una deuda |
| `createPayment(userId, debtId, paymentData)` | Registra un pago |
| `getDebtStats(userId)` | Calcula estadísticas |
| `updateDebtStatuses(userId)` | Marca deudas como overdue |
| `saveUser(user)` | Guarda/actualiza usuario |

---

## 🔒 Seguridad

- ✅ **Autenticación**: Todas las rutas verifican la sesión con NextAuth
- ✅ **Autorización**: Solo puedes acceder a tus propias deudas
- ✅ **Service Account**: Google Sheets API usa credenciales de servidor
- ✅ **Validación**: Todos los endpoints validan datos de entrada
- ✅ **Admin Only**: Inicialización de hojas solo para emails admin

---

## 🧪 Testing

### Test Manual

1. **Inicializar hojas** (solo admin):
```bash
curl -X PUT http://localhost:3000/api/debts \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN"
```

2. **Crear deuda**:
```bash
curl -X POST http://localhost:3000/api/debts \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN" \
  -d '{
    "name": "Test Debt",
    "amount": 1000,
    "dueDate": "2025-12-31"
  }'
```

3. **Obtener deudas**:
```bash
curl http://localhost:3000/api/debts \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN"
```

---

## 🐛 Troubleshooting

### Error: "Hoja no encontrada"
- Verifica que las hojas tengan los nombres exactos: `Debts`, `Payments`, `Users`
- Ejecuta `initializeSheets()` para crearlas automáticamente

### Error: "No autorizado"
- Verifica que estés autenticado con NextAuth
- Revisa que tu email esté en `ADMIN_EMAILS` para funciones admin

### Error: "GOOGLE_PRIVATE_KEY invalid"
- Asegúrate de que la clave tenga los saltos de línea correctos: `\n`
- Envuelve la clave completa en comillas dobles en el `.env`

### Error: "Spreadsheet not found"
- Verifica que `GOOGLE_SHEETS_ID` sea correcto
- Asegúrate de que el Service Account tenga acceso al spreadsheet

---

## 📊 Rendimiento

- **Reads**: ~500ms por consulta
- **Writes**: ~1s por operación
- **Limit**: 100 requests/100 segundos por usuario (Google Sheets API)

**Optimizaciones implementadas:**
- ✅ Batch updates cuando es posible
- ✅ Caché de datos en el cliente con `useDebts`
- ✅ Actualizaciones optimistas en la UI

---

## 🚀 Próximos Pasos

- [ ] Implementar caché con Redis
- [ ] Agregar paginación para listas grandes
- [ ] Implementar búsqueda y filtros
- [ ] Agregar notificaciones de pagos vencidos
- [ ] Exportar datos a CSV/PDF

---

## 📝 Notas

- Google Sheets es perfecto para **MVP** y **aplicaciones pequeñas**
- Para escalar, considera migrar a **PostgreSQL/MongoDB**
- El Service Account permite acceso sin OAuth del usuario
- Todas las fechas usan formato **ISO 8601**

---

✅ **Integración completada y documentada**
