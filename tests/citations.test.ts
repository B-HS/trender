import { describe, expect, test } from 'bun:test'
import { linkifyCitations } from '@lib/citations'

const map = new Map<number, number>([
    [1, 101],
    [2, 102],
    [12, 112],
])

describe('linkifyCitations', () => {
    test('단일 인용을 기사 링크로 변환한다', () => {
        expect(linkifyCitations('내용 [#1] 끝', map)).toBe('내용 [\\[#1\\]](/article/101) 끝')
    })

    test('여러 자리 숫자 인용을 처리한다', () => {
        expect(linkifyCitations('[#12]', map)).toBe('[\\[#12\\]](/article/112)')
    })

    test('연속된 인용을 모두 변환한다', () => {
        expect(linkifyCitations('[#1][#2]', map)).toBe('[\\[#1\\]](/article/101)[\\[#2\\]](/article/102)')
    })

    test('매핑 없는 인용은 그대로 둔다', () => {
        expect(linkifyCitations('[#99]', map)).toBe('[#99]')
    })

    test('인용이 없으면 원문 그대로다', () => {
        expect(linkifyCitations('인용 없는 본문', map)).toBe('인용 없는 본문')
    })

    test('[#n] 이 아닌 [n] 형식은 건드리지 않는다', () => {
        expect(linkifyCitations('[1] 일반 대괄호', map)).toBe('[1] 일반 대괄호')
    })
})
