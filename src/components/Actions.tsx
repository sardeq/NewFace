import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { DonateSheet } from './DonateSheet'
import { ShareSheet } from './ShareSheet'
import type { Issue } from '../types'

interface Actions {
  share: (i: Issue) => void
  donate: (i: Issue) => void
}
const Ctx = createContext<Actions>({ share: () => {}, donate: () => {} })

export function ActionsProvider({ children }: { children: ReactNode }) {
  const [shareIssue, setShare] = useState<Issue | null>(null)
  const [donateIssue, setDonate] = useState<Issue | null>(null)
  const closeShare = useCallback(() => setShare(null), [])
  const closeDonate = useCallback(() => setDonate(null), [])
  const value = useMemo(() => ({ share: setShare, donate: setDonate }), [])
  return (
    <Ctx.Provider value={value}>
      {children}
      <ShareSheet issue={shareIssue} onClose={closeShare} />
      <DonateSheet issue={donateIssue} onClose={closeDonate} />
    </Ctx.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useActions = () => useContext(Ctx)
