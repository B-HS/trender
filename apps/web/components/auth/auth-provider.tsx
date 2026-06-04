'use client'
import { createContext, useContext, useState, type FC, type PropsWithChildren } from 'react'
import { useMe } from '@/hooks/use-auth'
import { LoginDialog } from '@/components/auth/login-dialog'

type Me = { id: string; username: string }
type AuthContextValue = { me: Me | null; isLoading: boolean; openLogin: () => void }

const AuthContext = createContext<AuthContextValue>({ me: null, isLoading: false, openLogin: () => {} })

export const useAuth = () => useContext(AuthContext)

export const AuthProvider: FC<PropsWithChildren> = ({ children }) => {
    const [loginOpen, setLoginOpen] = useState(false)
    const { data: me, isLoading } = useMe()

    return (
        <AuthContext.Provider value={{ me: me ?? null, isLoading, openLogin: () => setLoginOpen(true) }}>
            {children}
            <LoginDialog open={loginOpen} onClose={() => setLoginOpen(false)} />
        </AuthContext.Provider>
    )
}
