import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '../data'
import { DEMO_PERSONAS } from '../data/mock/seed'
import { supabase } from '../lib/supabase'
import type { Profile, Role } from '../types'

interface Session {
  user: Profile | null
  loading: boolean
  /** mock mode: switch persona instantly. supabase mode: no-op (sign in as another account). */
  switchRole: (role: Role) => Promise<void>
  signInWithPassword: (email: string, password: string) => Promise<void>
  signUp: (v: { email: string; password: string; name: string; accountType: 'citizen' | 'contractor'; company?: string }) => Promise<void>
  signOut: () => Promise<void>
  isMock: boolean
}

const Ctx = createContext<Session | null>(null)
const PERSONA_KEY = 'mend.persona'

function readPersona(): string | null {
  try {
    return localStorage.getItem(PERSONA_KEY)
  } catch {
    return null
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const isMock = api.mode === 'mock'
  const [user, setUser] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const adopt = useCallback(
    async (id: string | null) => {
      api.setViewer(id)
      const p = id ? await api.getProfile(id) : null
      setUser(p)
      setLoading(false)
      qc.invalidateQueries()
    },
    [qc],
  )

  useEffect(() => {
    if (isMock) {
      Promise.resolve(readPersona() ?? DEMO_PERSONAS.citizen).then(adopt)
      return
    }
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => adopt(data.session?.user.id ?? null))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => void adopt(s?.user.id ?? null))
    return () => sub.subscription.unsubscribe()
  }, [adopt, isMock])

  const value = useMemo<Session>(
    () => ({
      user,
      loading,
      isMock,
      switchRole: async (role) => {
        if (!isMock) return
        const id = DEMO_PERSONAS[role]
        try {
          localStorage.setItem(PERSONA_KEY, id)
        } catch {
          /* ignore */
        }
        await adopt(id)
      },
      signInWithPassword: async (email, password) => {
        if (!supabase) throw new Error('Supabase is not configured — use the demo personas.')
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      },
      signUp: async ({ email, password, name, accountType, company }) => {
        if (!supabase) throw new Error('Supabase is not configured — use the demo personas.')
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name, account_type: accountType, company } },
        })
        if (error) throw error
      },
      signOut: async () => {
        if (supabase) await supabase.auth.signOut()
        else await adopt(null)
      },
    }),
    [user, loading, isMock, adopt],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSession() {
  const s = useContext(Ctx)
  if (!s) throw new Error('useSession outside SessionProvider')
  return s
}
