import { useState } from 'react'
import { Button, FundingTape, Sheet, toast } from './ui'
import { Icon } from './Icon'
import { useDonate } from '../data/hooks'
import { useSession } from '../session/SessionContext'
import { APP } from '../config'
import { fmtDateTime, fmtMoney, ticketRef } from '../lib/format'
import { t, useT } from '../i18n'
import type { Donation, Issue } from '../types'

const PRESETS = [5, 10, 25, 50, 100]
const METHODS = [
  { id: 'card', label: 'Card', note: 'Visa · Mastercard' },
  { id: 'cliq', label: 'CliQ', note: 'Instant bank transfer' },
  { id: 'wallet', label: 'Wallet', note: 'Mobile wallet' },
] as const
const methodLabel = (id: string) => METHODS.find((m) => m.id === id)?.label ?? id

export function DonateSheet({ issue, onClose }: { issue: Issue | null; onClose: () => void }) {
  useT()
  return (
    <Sheet
      open={Boolean(issue)}
      onClose={onClose}
      kicker={issue ? t('Fund {ref}', { ref: ticketRef(issue.ref) }) : ''}
      title={t('Chip in for the repair')}
      width={480}
    >
      {issue && <DonateFlow key={issue.id} issue={issue} onClose={onClose} />}
    </Sheet>
  )
}

function DonateFlow({ issue, onClose }: { issue: Issue; onClose: () => void }) {
  useT()
  const { user } = useSession()
  const donate = useDonate()
  const remaining = Math.max(0, (issue.estimatedCost ?? 0) - issue.raised)
  const [amount, setAmount] = useState<number>(remaining > 0 && remaining < 25 ? remaining : 10)
  const [custom, setCustom] = useState('')
  const [method, setMethod] = useState<(typeof METHODS)[number]['id']>('card')
  const [anon, setAnon] = useState(false)
  const [card, setCard] = useState({ num: '4242 4242 4242 4242', exp: '12/28', cvc: '123' })
  const [receipt, setReceipt] = useState<Donation | null>(null)

  const value = custom ? Number(custom) : amount
  const valid = value > 0 && value <= 100000

  const pay = async () => {
    if (!user) return toast('Sign in to donate', 'err')
    try {
      const d = await donate.mutateAsync({ issueId: issue.id, amount: value, anonymous: anon, method })
      setReceipt(d)
    } catch (e) {
      toast((e as Error).message, 'err')
    }
  }

  if (receipt)
    return (
      <div className="receipt-wrap">
        <div className="receipt">
          <div className="receipt-check" aria-hidden="true">
            <Icon name="check" size={26} stroke={2.6} />
          </div>
          <div className="receipt-logo mono caps">{t('{name} · civic fund', { name: t(APP.name) })}</div>
          <div className="receipt-amount num">{fmtMoney(receipt.amount)}</div>
          <div className="mono caps muted">{t('received — thank you')}</div>
          <dl className="receipt-rows mono">
            <div><dt>{t('Issue')}</dt><dd>{ticketRef(issue.ref)}</dd></div>
            <div><dt>{t('For')}</dt><dd className="clip">{issue.title}</dd></div>
            <div><dt>{t('Ref')}</dt><dd>{receipt.reference}</dd></div>
            <div><dt>{t('Method')}</dt><dd className="caps">{t(methodLabel(receipt.method))}</dd></div>
            <div><dt>{t('Shown as')}</dt><dd>{receipt.anonymous ? t('Anonymous') : user?.name}</dd></div>
            <div><dt>{t('Time')}</dt><dd>{fmtDateTime(receipt.createdAt)}</dd></div>
          </dl>
          <p className="receipt-note">
            {t('Logged to your account and to the public ledger of this issue. Funds are held by the municipality and released only to the authorised contractor.')}
          </p>
        </div>
        <Button variant="ink" onClick={onClose} className="w-full">
          {t('Done')}
        </Button>
      </div>
    )

  return (
    <div className="donate">
      <FundingTape raised={issue.raised} goal={issue.estimatedCost} donors={issue.donorCount} />

      <fieldset className="chips-set">
        <legend className="mono caps">{t('Amount')} · {t(APP.currency)}</legend>
        <div className="amount-chips">
          {PRESETS.map((p) => (
            <button key={p} className={`amount-chip num ${!custom && amount === p ? 'on' : ''}`} onClick={() => (setAmount(p), setCustom(''))}>
              {p}
            </button>
          ))}
          {remaining > 0 && !PRESETS.includes(remaining) && (
            <button
              className={`amount-chip amount-rest ${!custom && amount === remaining ? 'on' : ''}`}
              onClick={() => (setAmount(remaining), setCustom(''))}
            >
              {t('Close the gap')} · <span className="num">{fmtMoney(remaining, false)}</span>
            </button>
          )}
        </div>
        <input
          className="input num"
          inputMode="decimal"
          placeholder={t('Other amount')}
          value={custom}
          onChange={(e) => setCustom(e.target.value.replace(/[^\d.]/g, ''))}
        />
      </fieldset>

      <fieldset className="chips-set">
        <legend className="mono caps">{t('Pay with')}</legend>
        <div className="method-row">
          {METHODS.map((m) => (
            <button key={m.id} className={`method ${method === m.id ? 'on' : ''}`} onClick={() => setMethod(m.id)}>
              <strong>{t(m.label)}</strong>
              <span className="mono">{t(m.note)}</span>
            </button>
          ))}
        </div>
        {method === 'card' ? (
          <div className="card-form">
            <input className="input mono" value={card.num} onChange={(e) => setCard({ ...card, num: e.target.value })} aria-label={t('Card number')} />
            <input className="input mono" value={card.exp} onChange={(e) => setCard({ ...card, exp: e.target.value })} aria-label={t('Expiry')} />
            <input className="input mono" value={card.cvc} onChange={(e) => setCard({ ...card, cvc: e.target.value })} aria-label={t('CVC')} />
          </div>
        ) : (
          <p className="muted small">
            {method === 'cliq' ? t('You’ll confirm the transfer in your banking app.') : t('You’ll confirm the transfer in your wallet app.')}
          </p>
        )}
      </fieldset>

      <label className="check">
        <input type="checkbox" checked={anon} onChange={(e) => setAnon(e.target.checked)} />
        <span>{t('Hide my name on the public ledger')}</span>
      </label>

      <div className="testmode mono">
        <Icon name="info" size={14} /> {t('Test mode — no real money moves. Wire a payment provider before launch.')}
      </div>

      <Button variant="primary" size="lg" icon="coin" disabled={!valid} loading={donate.isPending} onClick={pay} className="w-full">
        {donate.isPending ? t('Processing…') : t('Give {amount}', { amount: fmtMoney(valid ? value : 0) })}
      </Button>
    </div>
  )
}
