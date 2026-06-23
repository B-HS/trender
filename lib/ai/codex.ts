import { getEnv } from '@lib/env'

type CodexInput = { role: 'user' | 'assistant'; text: string }

type CodexAuth = { tokens: { access_token: string; refresh_token: string; account_id: string } }

const DEFAULT_CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann'

let cachedToken: string | null = null

const getAuth = () => JSON.parse(getEnv().CODEX_AUTH ?? '{}') as CodexAuth

const refreshAccessToken = async () => {
    const auth = getAuth()
    const clientId = process.env.CODEX_CLIENT_ID ?? DEFAULT_CLIENT_ID
    const res = await fetch('https://auth.openai.com/oauth/token', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
            client_id: clientId,
            grant_type: 'refresh_token',
            refresh_token: auth.tokens.refresh_token,
            scope: 'openid profile email',
        }),
    })
    if (!res.ok) throw new Error(`codex refresh ${res.status}: ${(await res.text()).slice(0, 200)}`)
    const data = (await res.json()) as { access_token: string }
    cachedToken = data.access_token
    return cachedToken
}

const parseSse = (raw: string) => {
    let text = ''
    for (const block of raw.split('\n\n')) {
        const line = block.split('\n').find((l) => l.startsWith('data:'))
        if (!line) continue
        const payload = line.slice(5).trim()
        if (!payload || payload === '[DONE]') continue
        try {
            const evt = JSON.parse(payload) as { type: string; delta?: string; response?: { output?: { content?: { text?: string }[] }[] } }
            if (evt.type === 'response.output_text.delta' && evt.delta) text += evt.delta
            if (evt.type === 'response.completed' && !text) {
                const out = evt.response?.output ?? []
                for (const part of out) for (const c of part.content ?? []) text += c.text ?? ''
            }
        } catch {
            continue
        }
    }
    return text.trim()
}

const request = async (token: string, body: string) =>
    fetch('https://chatgpt.com/backend-api/codex/responses', {
        method: 'POST',
        headers: {
            authorization: `Bearer ${token}`,
            'chatgpt-account-id': getAuth().tokens.account_id,
            'content-type': 'application/json',
            'openai-beta': 'responses=experimental',
            originator: 'codex_cli_rs',
            session_id: crypto.randomUUID(),
            accept: 'text/event-stream',
        },
        body,
    })

export const callCodex = async ({ model, instructions, input }: { model: string; instructions: string; input: CodexInput[] }) => {
    const body = JSON.stringify({
        model,
        instructions,
        input: input.map((i) => ({ role: i.role, content: [{ type: i.role === 'assistant' ? 'output_text' : 'input_text', text: i.text }] })),
        stream: true,
        store: false,
    })

    let res = await request(cachedToken ?? getAuth().tokens.access_token, body)
    if (res.status === 401) res = await request(await refreshAccessToken(), body)
    if (!res.ok) throw new Error(`codex ${res.status}: ${(await res.text()).slice(0, 200)}`)
    return parseSse(await res.text())
}
