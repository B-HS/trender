import { start } from 'workflow/api'
import { NextResponse } from 'next/server'
import { crawlWorkflow } from '@workflows/crawl'

const isAuthorized = (request: Request) => {
    const secret = process.env.CRON_SECRET
    if (!secret) return true
    return request.headers.get('authorization') === `Bearer ${secret}`
}

export const GET = async (request: Request) => {
    if (!isAuthorized(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    await start(crawlWorkflow, [])
    return NextResponse.json({ started: true })
}
