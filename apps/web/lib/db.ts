import "server-only"
import { createDb } from "@workspace/db"

const globalForDb = globalThis as unknown as { __trenderDb?: ReturnType<typeof createDb> }

export const db = globalForDb.__trenderDb ?? createDb()

if (process.env.NODE_ENV !== "production") {
  globalForDb.__trenderDb = db
}
