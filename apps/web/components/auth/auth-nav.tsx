'use client'
import { Button } from '@workspace/ui/components/button'
import { useAuth } from '@/components/auth/auth-provider'
import { useLogout } from '@/hooks/use-auth'

export const AuthNav = () => {
    const { me, openLogin } = useAuth()
    const logout = useLogout()

    if (!me)
        return (
            <Button size='xs' variant='ghost' onClick={openLogin}>
                로그인
            </Button>
        )

    return (
        <div className='flex items-center gap-1'>
            <span className='text-muted-foreground text-xs'>{me.username}</span>
            <Button size='xs' variant='ghost' onClick={() => logout.mutate()} disabled={logout.isPending}>
                로그아웃
            </Button>
        </div>
    )
}
