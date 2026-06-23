import { z } from 'zod'

const envSchema = z.object({
    DATABASE_URL: z.string().min(1),
    CODEX_AUTH: z.string().min(1).optional(),
    TRANSLATE_MODEL: z.string().min(1).default('gpt-5.5'),
    KEYWORD_MODEL: z.string().min(1).default('gpt-5.4-mini'),
})

let cachedEnv: z.infer<typeof envSchema> | null = null

export const getEnv = () => {
    if (cachedEnv) return cachedEnv
    const result = envSchema.safeParse(process.env)
    if (!result.success) throw new Error(`Missing or invalid env: ${result.error.issues.map((i) => i.path.join('.')).join(', ')}`)
    cachedEnv = result.data
    return cachedEnv
}
