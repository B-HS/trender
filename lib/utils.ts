import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs))

export const getHostname = (url: string) => {
    try {
        return new URL(url).hostname.replace(/^www\./, '')
    } catch {
        return url
    }
}
