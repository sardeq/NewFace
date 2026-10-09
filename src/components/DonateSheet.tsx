import { useState } from 'react'
import { Button, FundingTape, Sheet, toast } from './ui'
import { Icon } from './Icon'
import { useDonate } from '../data/hooks'
import { useSession } from '../session/SessionContext'
import { APP } from '../config'
import { fmtDateTime, fmtMoney, ticketRef } from '../lib/format'
import type { Donation, Issue } from '../types'

const PRESETS = [5, 10, 25, 50, 100]
const METHODS = [
  { id: 'card', label: 'Card', note: 'Visa · Mastercard' },
  { id: 'cliq', label: 'CliQ', note: 'Instant bank transfer' },
  { id: 'wallet', label: 'Wallet', note: 'Mobile wallet' },
] as const

export function DonateSheet({ issue, onClose }: { issue: Issue | null; onClose: () => void }) {
  return (
    <Sheet open={Boolean(issue)} onClose={onClose} kicker={issue ? `Fund ${ticketRef(issue.ref)}` : ''} title="Chip in for the repair" width={480}>
      {issue && <DonateFlow key={issue.id} issue={issue} onClose={onClose} />}
    </Sheet>
  )
}

function DonateFlow({ issue, onClose }: { issue: Issue; onClose: () => void }) {
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
          <div className="receipt-logo mono caps">{APP.name} · civic fund</div>
          <div className="receipt-amount num">{fmtMoney(receipt.amount)}</div>
          <div className="mono caps muted">received — thank you</div>
          <dl className="receipt-rows mono">
            <div><dt>Issue</dt><dd>{ticketRef(issue.ref)}</dd></div>
            <div><dt>For</dt><dd className="clip">{issue.title}</dd></div>
            <div><dt>Ref</dt><dd>{receipt.reference}</dd></div>
            <div><dt>Method</dt><dd className="caps">{receipt.method}</dd></div>
            <div><dt>Shown as</dt><dd>{receipt.anonymous ? 'Anonymous' : user?.name}</dd></div>
            <div><dt>Time</dt><dd>{fmtDateTime(receipt.createdAt)}</dd></div>
          </dl>
          <p className="receipt-note">
            Logged to your account and to the public ledger of this issue. Funds are held by the municipality and released
            only to the authorised contractor.
          </p>
        </div>
        <Button variant="ink" onClick={onClose} className="w-full">
          Done
        </Button>
      </div>
    )

  return (
    <div className="donate">
      <FundingTape raised={issue.raised} goal={issue.estimatedCost} donors={issue.donorCount} />

      <fieldset className="chips-set">
        <legend className="mono caps">Amount · {APP.currency}</legend>
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
              Close the gap · <span className="num">{fmtMoney(remaining, false)}</span>
            </button>
          )}
        </div>
        <input
          className="input num"
          inputMode="decimal"
          placeholder="Other amount"
          value={custom}
          onChange={(e) => setCustom(e.target.value.replace(/[^\d.]/g, ''))}
        />
      </fieldset>

      <fieldset className="chips-set">
        <legend className="mono caps">Pay with</legend>
        <div className="method-row">
          {METHODS.map((m) => (
            <button key={m.id} className={`method ${method === m.id ? 'on' : ''}`} onClick={() => setMethod(m.id)}>
              <strong>{m.label}</strong>
              <span className="mono">{m.note}</span>
            </button>
          ))}
        </div>
        {method === 'card' ? (
          <div className="card-form">
            <input className="input mono" value={card.num} onChange={(e) => setCard({ ...card, num: e.target.value })} aria-label="Card number" />
            <input className="input mono" value={card.exp} onChange={(e) => setCard({ ...card, exp: e.target.value })} aria-label="Expiry" />
            <input className="input mono" value={card.cvc} onChange={(e) => setCard({ ...card, cvc: e.target.value })} aria-label="CVC" />
          </div>
        ) : (
          <p className="muted small">You’ll confirm the transfer in your {method === 'cliq' ? 'banking' : 'wallet'} app.</p>
        )}
      </fieldset>

      <label className="check">
        <input type="checkbox" checked={anon} onChange={(e) => setAnon(e.target.checked)} />
        <span>Hide my name on the public ledger</span>
      </label>

      <div className="testmode mono">
        <Icon name="info" size={14} /> Test mode — no real money moves. Wire a payment provider before launch.
      </div>

      <Button variant="primary" size="lg" icon="coin" disabled={!valid} loading={donate.isPending} onClick={pay} className="w-full">
        {donate.isPending ? 'Processing…' : `Give ${fmtMoney(valid ? value : 0)}`}
      </Button>
    </div>
  )
}
