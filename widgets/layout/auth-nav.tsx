'use client'

import { useLogin, useLogout, useMe } from '@entities/auth/auth.client'
import { Button } from '@ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@ui/dialog'
import { Input } from '@ui/input'
import { Bookmark, LogIn, LogOut } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'

export const AuthNav = () => {
    const [open, setOpen] = useState(false)
    const [username, setUsername] = useState('')
    const { data: me } = useMe()
    const login = useLogin()
    const logout = useLogout()

    const handleLogin = () => {
        const trimmed = username.trim()
        if (!trimmed) return
        login.mutate(trimmed, {
            onSuccess: () => {
                setOpen(false)
                setUsername('')
                toast.success(`${trimmed} 님 환영합니다`)
            },
            onError: () => toast.error('로그인에 실패했습니다'),
        })
    }

    if (me?.user)
        return (
            <div className='flex items-center gap-1'>
                <Link href='/bookmarks' className='text-sm font-medium px-2 flex items-center gap-1'>
                    <Bookmark className='size-4' />
                    <span className='hidden sm:inline'>{me.user.username}</span>
                </Link>
                <Button variant='ghost' size='icon' aria-label='로그아웃' onClick={() => logout.mutate()}>
                    <LogOut />
                </Button>
            </div>
        )

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant='ghost' size='icon' aria-label='로그인'>
                    <LogIn />
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>로그인</DialogTitle>
                </DialogHeader>
                <Input
                    placeholder='유저이름'
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                />
                <DialogFooter>
                    <Button onClick={handleLogin} disabled={login.isPending}>
                        시작하기
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
