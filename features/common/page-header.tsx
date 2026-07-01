import { RevalidateButton } from '@features/common/revalidate-button'
import { FC, ReactNode } from 'react'

type PageHeaderProps = {
    title: ReactNode
    revalidatePath: string
    revalidateTags?: string[]
}

export const PageHeader: FC<PageHeaderProps> = ({ title, revalidatePath, revalidateTags }) => (
    <div className='flex items-center justify-between'>
        <h1 className='text-2xl font-bold'>{title}</h1>
        <RevalidateButton path={revalidatePath} tags={revalidateTags} />
    </div>
)
