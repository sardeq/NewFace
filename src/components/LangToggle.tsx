import { useState } from 'react'
import { Icon } from './Icon'
import { switchLang, t, useLang } from '../i18n'

/**
 * EN ⇄ ع switch. The label flips like a split-flap sign, the globe spins, and the whole page
 * is revealed in the new language with a circle that grows out of the button.
 */
export function LangToggle({ className = '' }: { className?: string }) {
  const lang = useLang()
  const [spin, setSpin] = useState(0)
  const next = lang === 'en' ? 'ar' : 'en'
  return (
    <button
      type="button"
      className={`lang-toggle ${className}`}
      data-lang={lang}
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect()
        setSpin((s) => s + 1)
        switchLang(next, { x: r.left + r.width / 2, y: r.top + r.height / 2 })
      }}
      aria-label={t('Switch to {lang}', { lang: next === 'ar' ? 'العربية' : 'English' })}
      title={next === 'ar' ? 'العربية' : 'English'}
    >
      <Icon name="globe" size={17} key={spin} className="lang-globe" />
      <span className="lang-flap" aria-hidden="true">
        <span className="lang-face lang-face-en">EN</span>
        <span className="lang-face lang-face-ar" lang="ar">ع</span>
      </span>
    </button>
  )
}
