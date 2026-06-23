import { drizzle } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'
import { getEnv } from '@lib/env'
import * as schema from './schema'

const globalForDb = globalThis as unknown as { __dbPool?: mysql.Pool }

const getPool = () => {
    if (globalForDb.__dbPool) return globalForDb.__dbPool
    const pool = mysql.createPool({ uri: getEnv().DATABASE_URL, connectionLimit: 5, waitForConnections: true })
    globalForDb.__dbPool = pool
    return pool
}

export const db = drizzle(getPool(), { schema, mode: 'default', casing: 'snake_case' })
