# FINDIA — Estado del proyecto (handoff entre sesiones/máquinas)

> Este archivo existe para que una sesión nueva (otra compu, u otra conversación
> de Claude Code) pueda retomar el trabajo sin perder contexto. Reflejar acá
> únicamente el estado real verificable (branches, env vars, fases) — no
> decisiones de diseño ya documentadas en el código.

## Metodología

Migración de persistencia de Google Sheets a PostgreSQL (Neon), módulo por
módulo, fase por fase, con gates explícitos antes de tocar Production. Patrón
de storage switch por dominio: `<DOMINIO>_STORAGE` (`sheets` default) +
`<DOMINIO>_POSTGRES_PRODUCTION_ENABLED` (obligatorio además en Production).

## Estado por fase (2026-09-02)

| Fase | Módulo | Estado |
|---|---|---|
| DB-1..DB-6 | Gastos Compartidos V2 | Completo, en Production (Postgres) |
| DB-7A/7B | Cutover Production Gastos Compartidos V2 | **COMPLETE** |
| DB-8 (audit) | Mapa completo de módulos pendientes | Entregado (artifact "FINDIA Decommission Map") |
| DB-8.0S | Hotfix seguridad (migration token + test-email) | Completo, en Production |
| DB-8.1 | PushSubscriptions → Postgres | **COMPLETE**, en Production |
| DB-8.2 | Categories + Subcategories → Postgres | **En curso — solo staging**, ver abajo |
| DB-8.3+ | Expenses/Incomes, Debts/Payments, CreditCards, Goals, Users | No iniciado |

## Rama activa: `db8-2-categories-subcategories`

Pusheada a `origin`. Contiene:
- Schema Drizzle: tablas `categories`/`subcategories` (`lib/db/schema.ts`,
  migración `drizzle/0002_opposite_leader.sql`), aplicada en Neon **staging**.
- Repositorio dual Sheets/Postgres: `lib/repositories/categories/`.
- Rutas reescritas: `app/api/categories/route.ts`, `app/api/subcategories/route.ts`.
- Herramienta de migración: `scripts/db8-2/` (`read/validate/transform/importer/verify/report/run`).
- Tests: `scripts/db8-2-storage-switch-tests.ts` (8/8), `scripts/db8-2-postgres-contract-tests.ts` (14/14).
- Import real a staging ya ejecutado y verificado campo a campo (`VERIFICATION: OK`):
  16 categories / 45 subcategories / 0 errores críticos.

**Siguiente paso pendiente:** confirmar que el build de Preview en Vercel para
esta rama esté Ready, luego configurar `CATEGORIES_STORAGE=postgres` scopeado
solo a **Preview** (NO `CATEGORIES_POSTGRES_PRODUCTION_ENABLED`, Production sin
tocar) y correr el QA de Preview (carga/filtros/alta de categorías y
subcategorías, categorías default/globales, y el check crítico de selección
híbrida: elegir una categoría/subcategoría de Postgres al crear un
Expense/Income que todavía persiste en Sheets). Si pasa: reportar
`DB-8.2 TECHNICAL/STAGING: PASS` y proponer (sin ejecutar) el runbook de
cutover a Production, igual al patrón de DB-8.1 (freeze → snapshot → import →
parity → switch → write smoke → reopen → source of truth).

**No tocar en esta fase:** Expenses/Incomes, Users/Auth, Shared Groups V2,
PushSubscriptions, Production.

## Variables de entorno necesarias para desarrollar local

No están en git (`.env*` en `.gitignore`). Copiar `.env.local` de una máquina
a otra por un canal privado (no chat/email en texto plano). Claves usadas hoy
(ver `.env.example` para la plantilla base, incompleta respecto a esto):

- `NEXTAUTH_URL`, `NEXTAUTH_SECRET`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `GOOGLE_SHEETS_ID`, `GOOGLE_API_KEY`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`
- `NEXT_PUBLIC_GOOGLE_SHEETS_ID`, `NEXT_PUBLIC_GOOGLE_API_KEY`
- `ADMIN_EMAILS`
- `EMAIL_USER`, `EMAIL_PASSWORD`
- `DATABASE_URL`, `DATABASE_URL_POOLED` (Neon **staging**)
- `DATABASE_URL_PRODUCTION`, `DATABASE_URL_PRODUCTION_POOLED` (Neon **Production** — usar con extremo cuidado)

En Vercel (no en `.env.local`) además existen, por ambiente:
- Shared Groups V2: `SHARED_GROUPS_STORAGE`, `SHARED_GROUPS_POSTGRES_PRODUCTION_ENABLED`
- PushSubscriptions: `PUSH_SUBSCRIPTIONS_STORAGE`, `PUSH_SUBSCRIPTIONS_POSTGRES_PRODUCTION_ENABLED`, `PUSH_SUBSCRIPTIONS_MAINTENANCE_MODE`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (par de claves distinto en Preview vs Production)
- Categories (DB-8.2, pendiente de configurar): `CATEGORIES_STORAGE`, `CATEGORIES_POSTGRES_PRODUCTION_ENABLED`

## Cosas aprendidas que conviene no repetir

- En Vercel, `NEXT_PUBLIC_*` se hornean en build time: un simple "Redeploy" no
  alcanza si reusa cache — forzar build fresco (`git commit --allow-empty && git push`).
- `middleware.ts` con `runtime: 'nodejs'` rompe silenciosamente el registro del
  middleware en Next 15.5.9 — dejar el runtime edge default.
- Deployment Protection (SSO) de Vercel bloquea el registro del Service Worker
  en URLs de Preview — probar Service Worker con `npm run build && npm run start`
  local, no contra la URL de Preview.
- Para diagnosticar errores solo-Production, pedir siempre el log/consola real
  (no asumir la causa) — dos incidentes reales (`28P01` de Postgres,
  `bad-precaching-response` de Workbox) se resolvieron así.

## Bugs preexistentes documentados, no relacionados con las migraciones activas

Ver artifact "FINDIA Decommission Map" (DB-8 audit) para el listado completo
(33 items). Los dos relevantes para Categories/Subcategories, deliberadamente
no tocados en DB-8.2:
- `updateCategory`/`deleteCategory` del hook `useCategories.ts` son código
  muerto (no hay ruta `[id]` que los respalde).
- `app/api/subcategories/route.ts` llama `getServerSession()` sin
  `authOptions`, inconsistente con `app/api/categories/route.ts` que sí lo pasa.
