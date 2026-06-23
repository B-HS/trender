import { describe, expect, test } from 'bun:test'
import { PROVIDERS } from '@entities/source/registry'
import { PROVIDER_IDS } from '@entities/source/provider-ids'

describe('provider 레지스트리', () => {
    test('PROVIDER_IDS 가 레지스트리와 정확히 일치한다', () => {
        expect([...PROVIDER_IDS].sort()).toEqual(PROVIDERS.map((p) => p.id).sort())
    })

    test('provider id 는 중복이 없다', () => {
        const ids = PROVIDERS.map((p) => p.id)
        expect(new Set(ids).size).toBe(ids.length)
    })

    test('vendor provider 는 kind=vendor 다', () => {
        for (const p of PROVIDERS) expect(p.vendor ? p.kind === 'vendor' : p.kind === 'web').toBe(true)
    })
})
