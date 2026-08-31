/**
 * Config de drizzle-kit (Fase DB-2). Genera/corre migraciones SOLO para el
 * schema de Gastos Compartidos V2 -- ningún otro módulo de FINDIA está
 * incluido acá.
 */
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
