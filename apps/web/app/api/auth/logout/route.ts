import { deleteSession } from '@/lib/auth/session'
import { ok } from '@/lib/api.server'

export const POST = async () => {
    await deleteSession()
    return ok({ done: true })
}
