import { useEffect, useRef, useState } from 'react'
import { observeIn, unobserveIn } from '../lib/motion'
import { isEditing } from '../lib/edits'
import Editable from './Editable'

// 联系页：两行联系方式（邮箱 / 电话）。点击行即复制对应内容到剪贴板，
// 不再触发任何跳转；编辑模式下点击仍进入文字编辑。
export default function Contact() {
  const ref = useRef(null)
  const [copied, setCopied] = useState(null)

  useEffect(() => {
    const el = ref.current
    observeIn(el)
    return () => unobserveIn(el)
  }, [])

  const copy = async (e, key) => {
    if (isEditing()) return
    const text = e.currentTarget.textContent.trim()
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const range = document.createRange()
      range.selectNodeContents(e.currentTarget)
      const sel = window.getSelection()
      sel.removeAllRanges()
      sel.addRange(range)
    }
    setCopied(key)
    window.setTimeout(() => setCopied(null), 500)
  }

  return (
    <main ref={ref} className="contact">
      <div className="wrap contact__inner">
        <div className="kicker mono">
          <span className="mask"><span className="mask-in"><Editable k="contact-kicker" fallback="联系 — CONTACT" /></span></span>
        </div>
        <button
          type="button"
          className="contact__mail st"
          style={{ '--d': '280ms' }}
          onClick={(e) => copy(e, 'mail-1')}
          aria-label="复制邮箱"
        >
          <span className="contact__mail-text"><Editable k="contact-mail" fallback="1205898527@qq.com" /></span>
          {copied === 'mail-1' && <span className="contact__copied">已复制</span>}
        </button>
        <button
          type="button"
          className="contact__mail contact__mail--dup st"
          style={{ '--d': '340ms' }}
          onClick={(e) => copy(e, 'mail-2')}
          aria-label="复制电话"
        >
          <span className="contact__mail-text"><Editable k="contact-mail-2" fallback="183 1738 9976" /></span>
          {copied === 'mail-2' && <span className="contact__copied">已复制</span>}
        </button>
      </div>
    </main>
  )
}
