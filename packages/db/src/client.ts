import { drizzle } from "drizzle-orm/mysql2"
import mysql from "mysql2/promise"
import * as schema from "./schema"

const resolveUrl = () => {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL is required")
  return url
}

export const createDb = (url = resolveUrl()) => {
  const pool = mysql.createPool({ uri: url, connectionLimit: 5 })
  return drizzle(pool, { schema, mode: "default" })
}

export type Database = ReturnType<typeof createDb>
