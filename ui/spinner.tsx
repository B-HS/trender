import { cn } from '@lib/utils'
import { Loader2 } from 'lucide-react'
import { FC } from 'react'

export const Spinner: FC<{ className?: string }> = ({ className }) => (
    <Loader2 className={cn('size-5 animate-spin text-muted-foreground', className)} />
)
