'use client'

import { revalidatePageCache } from '@lib/revalidate.action'
import { cn } from '@lib/utils'
import { Button } from '@ui/button'
import { RotateCw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { FC, useState } from 'react'
import { toast } from 'sonner'

type RevalidateButtonProps = {
    path: string
    tags?: string[]
    className?: string
}

export const RevalidateButton: FC<RevalidateButtonProps> = ({ path, tags, className }) => {
    const [pending, setPending] = useState(false)
    const router = useRouter()

    const handleClick = async () => {
        setPending(true)
        try {
            await revalidatePageCache({ path, tags })
            router.refresh()
            toast.success('최신 데이터로 갱신했습니다')
        } catch {
            toast.error('갱신에 실패했습니다')
        } finally {
            setPending(false)
        }
    }

    return (
        <Button
            type='button'
            variant='ghost'
            size='icon'
            className={cn('size-7 text-muted-foreground', className)}
            aria-label='캐시 갱신'
            disabled={pending}
            onClick={handleClick}>
            <RotateCw className={cn('size-4', pending && 'animate-spin')} />
        </Button>
    )
}
