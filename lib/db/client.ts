/**
 * Cliente Drizzle (Fase DB-2). Driver `node-postgres` estándar -- funciona
 * igual contra un Postgres local (Docker, para pruebas) y contra Neon vía
 * connection string TCP normal (`postgresql://...`). No usa el driver
 * serverless/HTTP específico de Neon todavía: esa optimización se evalúa
 * recién cuando haya handlers reales corriendo en funciones serverless de
 * Vercel (Fase DB-6/DB-7), no antes.
 *
 * Ningún archivo de FINDIA importa este módulo todavía -- no está conectado
 * a ningún handler/hook/componente. Existe únicamente para poder correr las
 * migraciones y validar el schema en esta fase.
 */
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import * as schema from './schema'

function createPool() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('Falta DATABASE_URL -- ninguna feature productiva de FINDIA depende de esto todavía (Fase DB-2).')
  }
  return new Pool({ connectionString })
}

let poolSingleton: Pool | null = null

/** Singleton reutilizado entre invocaciones warm (patrón estándar Next.js/Vercel) -- se crea recién en el primer uso, nunca al importar el módulo. */
function getPool(): Pool {
  if (!poolSingleton) poolSingleton = createPool()
  return poolSingleton
}

export function getDb() {
  return drizzle(getPool(), { schema })
}

/** Cierra el pool (libera todas las conexiones). Uso exclusivo de scripts
 * standalone (ej. contract tests de Fase DB-4) para poder terminar el
 * proceso limpio -- Next.js nunca debería llamar esto (el pool tiene que
 * seguir vivo entre requests). No-op si el pool nunca se creó. */
export async function closePool(): Promise<void> {
  if (poolSingleton) {
    await poolSingleton.end()
    poolSingleton = null
  }
}
