'use client'
import { useEffect, useRef, useState, type FC, type FormEvent } from 'react'
import { Button } from '@workspace/ui/components/button'
import { useLogin } from '@/hooks/use-auth'

type LoginDialogProps = {
    open: boolean
    onClose: () => void
}

export const LoginDialog: FC<LoginDialogProps> = ({ open, onClose }) => {
    const ref = useRef<HTMLDialogElement>(null)
    const [username, setUsername] = useState('')
    const login = useLogin()

    useEffect(() => {
        const el = ref.current
        if (!el) return
        if (open && !el.open) el.showModal()
        if (!open && el.open) el.close()
    }, [open])

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault()
        const name = username.trim()
        if (name.length < 2) return
        login.mutate(name, {
            onSuccess: () => {
                setUsername('')
                onClose()
            },
        })
    }

    return (
        <dialog
            ref={ref}
            onClose={onClose}
            className='bg-background text-foreground m-auto w-[min(90vw,360px)] rounded-none p-0 ring-1 ring-foreground/10 backdrop:bg-black/40'>
            <form onSubmit={handleSubmit} className='flex flex-col gap-3 p-5'>
                <h2 className='text-lg font-semibold'>로그인</h2>
                <p className='text-muted-foreground text-xs'>아이디만 입력하면 됩니다. 처음이면 자동으로 가입돼요.</p>
                <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder='아이디 (2~20자)'
                    aria-label='아이디'
                    autoFocus
                    className='border-border bg-background focus:ring-ring/40 h-9 w-full rounded-none border px-3 text-sm outline-none focus:ring-1'
                />
                {login.isError ? <p className='text-destructive text-xs'>{(login.error as Error).message}</p> : null}
                <div className='flex justify-end gap-2 pt-1'>
                    <Button type='button' size='sm' variant='ghost' onClick={onClose}>
                        취소
                    </Button>
                    <Button type='submit' size='sm' disabled={login.isPending || username.trim().length < 2}>
                        {login.isPending ? '로그인 중…' : '로그인'}
                    </Button>
                </div>
            </form>
        </dialog>
    )
}
