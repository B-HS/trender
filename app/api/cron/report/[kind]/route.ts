import { start } from 'workflow/api'
import { NextResponse } from 'next/server'
import { reportWorkflow } from '@workflows/report'

const isAuthorized = (request: Request) => {
    const secret = process.env.CRON_SECRET
    if (!secret) return true
    return request.headers.get('authorization') === `Bearer ${secret}`
}

export const GET = async (request: Request, { params }: { params: Promise<{ kind: string }> }) => {
    if (!isAuthorized(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    const { kind } = await params
    if (kind !== 'daily' && kind !== 'weekly') return NextResponse.json({ error: 'invalid kind' }, { status: 400 })
    await start(reportWorkflow, [kind])
    return NextResponse.json({ started: true, kind })
}
