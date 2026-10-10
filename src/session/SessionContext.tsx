import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '../data'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types'

interface Session {
  user: Profile | null
  loading: boolean
  signInWithPassword: (email: string, password: string) => Promise<void>
  /** Resolves to true when the account still needs its email confirmed before it can sign in. */
  signUp: (v: { email: string; password: string; name: string; accountType: 'citizen' | 'contractor'; company?: string }) => Promise<boolean>
  resendConfirmation: (email: string) => Promise<void>
  signOut: () => Promise<void>
}

const Ctx = createContext<Session | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const [user, setUser] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const adopt = useCallback(
    async (id: string | null) => {
      api.setViewer(id)
      let p: Profile | null = null
      try {
        p = id ? await api.getProfile(id) : null
        if (id && !p) console.warn('[session] signed in, but no profiles row for', id, '— is the on_auth_user_created trigger installed?')
      } catch (e) {
        console.error('[session] could not load profile', e)
      } finally {
        setUser(p)
        setLoading(false)
        qc.invalidateQueries()
      }
    },
    [qc],
  )

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => adopt(data.session?.user.id ?? null))
    // Supabase runs this callback while holding its auth lock; calling another Supabase method
    // inside it (getProfile does) can deadlock sign-in. Defer to the next tick, as their docs advise.
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      const id = s?.user.id ?? null
      setTimeout(() => void adopt(id), 0)
    })
    return () => sub.subscription.unsubscribe()
  }, [adopt])

  const value = useMemo<Session>(
    () => ({
      user,
      loading,
      signInWithPassword: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      },
      signUp: async ({ email, password, name, accountType, company }) => {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          // Confirmation link lands back on this app (add the URL under Auth → URL Configuration → Redirect URLs).
          options: { data: { name, account_type: accountType, company }, emailRedirectTo: location.origin },
        })
        if (error) throw error
        // With "Confirm email" on, an existing address gets a user with no identities instead of an error.
        if (data.user && data.user.identities?.length === 0) throw new Error('An account with this email already exists — sign in instead.')
        return !data.session
      },
      resendConfirmation: async (email) => {
        const { error } = await supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: location.origin } })
        if (error) throw error
      },
      signOut: async () => {
        await supabase.auth.signOut()
      },
    }),
    [user, loading],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSession() {
  const s = useContext(Ctx)
  if (!s) throw new Error('useSession outside SessionProvider')
  return s
}
