import { Icon } from './Icon'
import { categoryLabel, fmtMoney } from '../lib/format'
import { t, useT } from '../i18n'
import type { BidAssessment, CostAssessment, IssueAssessment } from '../types'

const VERDICT = {
  accept: { label: 'Accept', tone: 'moss', icon: 'check' },
  reject: { label: 'Reject', tone: 'signal', icon: 'x' },
  review: { label: 'Needs a human', tone: 'ochre', icon: 'eye' },
} as const

type Any = IssueAssessment | BidAssessment | CostAssessment

/** The "inspector's slip" — how Gemma's decision is shown everywhere. */
export function AiSlip({
  a,
  heading,
  compact,
  outcome,
}: {
  a: Any
  heading?: string
  compact?: boolean
  outcome?: string
}) {
  useT()
  const head = heading ? t(heading) : t('Gemma screening')
  const v = VERDICT[a.verdict]
  const conf = Math.round(a.confidence * 100)
  return (
    <section className={`ai-slip tone-${v.tone} ${compact ? 'is-compact' : ''}`} aria-label={head}>
      <header className="ai-slip-head">
        <span className="ai-chip mono caps">
          <Icon name="scan" size={14} /> {head}
        </span>
        <span className="ai-verdict">
          <Icon name={v.icon} size={15} stroke={2.4} />
          {t(v.label)}
        </span>
      </header>
      <div className="ai-conf" title={t('{n}% confidence', { n: conf })}>
        <div className="ai-conf-track">
          <i style={{ width: `${conf}%` }} />
        </div>
        <span className="mono num">{t('{n}% sure', { n: conf })}</span>
        {'score' in a && <span className="mono num">· {t('score {n}/100', { n: a.score })}</span>}
      </div>
      {'category' in a && !compact && (
        <dl className="ai-facts">
          <div>
            <dt className="mono caps">{t('Category')}</dt>
            <dd>{categoryLabel(a.category)}</dd>
          </div>
          <div>
            <dt className="mono caps">{t('Severity')}</dt>
            <dd className="num">{a.severity} / 5</dd>
          </div>
          <div>
            <dt className="mono caps">{t('Likely cost')}</dt>
            <dd className="num">
              {a.costRange[1] ? `${fmtMoney(a.costRange[0])}–${fmtMoney(a.costRange[1], false)}` : '—'}
            </dd>
          </div>
        </dl>
      )}
      {a.reasons.length > 0 && (
        <ul className="ai-reasons">
          {a.reasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      )}
      {outcome && <p className="ai-outcome">{outcome}</p>}
      <footer className="ai-foot mono">
        {a.source === 'gemma' ? a.model : t('offline rules · add an OpenRouter key for Gemma')}
      </footer>
    </section>
  )
}
