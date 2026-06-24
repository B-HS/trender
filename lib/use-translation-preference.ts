'use client'

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'tt_show_translated'

export const useTranslationPreference = () => {
    const [showTranslated, setShowTranslated] = useState(false)

    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY)
        setShowTranslated(stored === null ? true : stored === '1')
    }, [])

    const update = (next: boolean) => {
        setShowTranslated(next)
        localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
    }

    return [showTranslated, update] as const
}
