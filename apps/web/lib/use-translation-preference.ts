'use client'
import { useEffect, useState } from 'react'

const STORAGE_KEY = 'trender:show-translated'

export const useTranslationPreference = () => {
    const [showTranslated, setShowTranslated] = useState(true)

    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored !== null) setShowTranslated(stored === '1')
    }, [])

    const update = (value: boolean) => {
        setShowTranslated(value)
        localStorage.setItem(STORAGE_KEY, value ? '1' : '0')
    }

    return [showTranslated, update] as const
}
