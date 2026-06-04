import { NextResponse } from 'next/server'

export const ok = <T>(data: T) => NextResponse.json({ success: true, data })

export const fail = (code: string, message: string, status = 400) =>
    NextResponse.json({ success: false, error: { code, message } }, { status })
