import { listFavoriteArticles } from '@entities/favorite/favorite.repo'
import { BookmarksList } from '@features/article/bookmarks-list'
import { getCurrentUser } from '@lib/auth/session'

export const dynamic = 'force-dynamic'

const Page = async () => {
    const user = await getCurrentUser()
    if (!user) return <p className='text-muted-foreground py-16 text-center'>로그인 후 북마크를 확인할 수 있습니다.</p>

    const articles = await listFavoriteArticles(user.id)

    return (
        <div className='flex flex-col gap-3 py-2'>
            <h1 className='text-2xl font-bold'>북마크</h1>
            <BookmarksList initial={articles} />
        </div>
    )
}

export default Page
