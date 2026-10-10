import { useState } from 'react'
import { Button, Field, toast } from './ui'
import { AiSlip } from './AiPanel'
import { useSubmitBid } from '../data/hooks'
import { api } from '../data'
import { useSession } from '../session/SessionContext'
import { screenBid } from '../lib/ai'
import { APP } from '../config'
import { t, useT } from '../i18n'
import type { Bid, Issue } from '../types'

export function BidForm({ issue, onDone }: { issue: Issue; onDone?: (b: Bid) => void }) {
  useT()
  const { user } = useSession()
  const submit = useSubmitBid()
  const [amount, setAmount] = useState(String(issue.estimatedCost ?? issue.ai?.costRange[1] ?? ''))
  const [days, setDays] = useState('3')
  const [message, setMessage] = useState('')
  const [phase, setPhase] = useState<'form' | 'screening'>('form')
  const [done, setDone] = useState<Bid | null>(null)

  const valid = Number(amount) > 0 && Number(days) > 0 && message.trim().length >= 10

  const send = async () => {
    if (!user) return
    setPhase('screening')
    try {
      const jobs = await api.contractorJobsDone(user.id)
      const ai = await screenBid({
        issue,
        bid: { amount: Number(amount), days: Number(days), message },
        contractor: { company: user.company, verified: user.verified, completedJobs: jobs },
      })
      const b = await submit.mutateAsync({ issueId: issue.id, amount: Number(amount), days: Number(days), message, ai })
      setDone(b)
      onDone?.(b)
      toast(b.status === 'approved' ? 'Work authorised — Gemma approved your bid' : 'Bid submitted to the municipal desk')
    } catch (e) {
      toast((e as Error).message, 'err')
    } finally {
      setPhase('form')
    }
  }

  if (done)
    return (
      <div className="bid-done">
        {done.status === 'approved' ? (
          <p>
            <strong>{t('Work authorised.')}</strong> {t('Gemma approved your bid automatically')}
            {done.authorization ? ` — ${t('authorisation {code}', { code: done.authorization })}` : ''}. {t('You may begin physical work.')}
          </p>
        ) : (
          <p>
            <strong>{t('Bid filed.')}</strong>{' '}
            {t('The municipal desk will review it — you’ll get a dispatch the moment it’s approved and you’re authorised to start.')}
          </p>
        )}
        {done.ai && <AiSlip a={done.ai} heading="Gemma bid review" compact />}
      </div>
    )

  return (
    <div className="bid-form">
      <div className="bid-grid">
        <Field
          label={`${t('Price')} · ${t(APP.currency)}`}
          hint={issue.estimatedCost ? t('Official estimate {amount}', { amount: issue.estimatedCost }) : undefined}
        >
          <input className="input num" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} />
        </Field>
        <Field label={t('Working days')}>
          <input className="input num" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, ''))} />
        </Field>
      </div>
      <Field label={t('Method statement')} hint={t('Materials, crew, traffic management, and when you can start.')}>
        <textarea className="input textarea" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} />
      </Field>
      {!user?.verified && (
        <p className="note-warn small">{t('Your company isn’t verified yet — bids from unverified contractors are scored lower.')}</p>
      )}
      <Button variant="ink" icon="hammer" disabled={!valid} loading={phase === 'screening'} onClick={send}>
        {phase === 'screening' ? t('Gemma is reviewing…') : t('Submit bid')}
      </Button>
    </div>
  )
}
