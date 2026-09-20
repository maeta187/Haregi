import { createDb } from '@haregi/db'
import { createAuth } from './create-auth.ts'

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value)
    throw new Error(`${name} が設定されていません(.env.example を参照)`)
  return value
}

const config = {
  baseURL: requiredEnv('BETTER_AUTH_URL'),
  secret: requiredEnv('BETTER_AUTH_SECRET'),
  webOrigin: requiredEnv('WEB_ORIGIN'),
}
export const authDatabase = createDb(requiredEnv('DATABASE_URL'))
export const auth = createAuth(authDatabase.db, config)
