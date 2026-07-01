'use server'

import { revalidatePath, updateTag } from 'next/cache'

export const revalidatePageCache = async ({ path, tags = [] }: { path: string; tags?: string[] }) => {
    for (const tag of tags) updateTag(tag)
    revalidatePath(path)
}
