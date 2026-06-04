import { test, expect, describe } from 'bun:test'
import { linkifyCitations } from './citations'

describe('linkifyCitations', () => {
    const map = new Map([
        [1, 101],
        [2, 202],
        [12, 1212],
    ])

    test('단일 인용을 기사 링크로 치환한다', () => {
        expect(linkifyCitations('근거 [#1] 참고', map)).toBe('근거 [#1](/articles/101) 참고')
    })

    test('여러 자리수 rank도 치환한다', () => {
        expect(linkifyCitations('[#12]', map)).toBe('[#12](/articles/1212)')
    })

    test('붙어 있는 다중 인용을 모두 치환한다', () => {
        expect(linkifyCitations('[#1][#2]', map)).toBe('[#1](/articles/101)[#2](/articles/202)')
    })

    test('매핑에 없는 rank는 원문 그대로 둔다', () => {
        expect(linkifyCitations('[#99]', map)).toBe('[#99]')
    })

    test('인용이 없으면 변경하지 않는다', () => {
        expect(linkifyCitations('인용 없는 본문', map)).toBe('인용 없는 본문')
    })

    test('빈 맵이면 모든 인용을 그대로 둔다', () => {
        expect(linkifyCitations('[#1] [#2]', new Map())).toBe('[#1] [#2]')
    })

    test('인용과 인용 아닌 대괄호를 구분한다', () => {
        expect(linkifyCitations('[note] [#1]', map)).toBe('[note] [#1](/articles/101)')
    })
})
