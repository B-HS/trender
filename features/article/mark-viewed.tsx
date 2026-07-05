'use client'

import { useMarkViewed } from '@entities/article/article.client'
import { useMe } from '@entities/auth/auth.client'
import { FC, useEffect, useRef } from 'react'

export const MarkViewed: FC<{ articleId: number }> = ({ articleId }) => {
    const sentRef = useRef(false)
    const { data: me } = useMe()
    const markViewed = useMarkViewed()

    useEffect(() => {
        if (!me?.user || sentRef.current) return
        sentRef.current = true
        markViewed.mutate(articleId)
    }, [me?.user, articleId, markViewed])

    return null
}
