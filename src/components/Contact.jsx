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

  const mailIco = (
    <svg className="contact__ico" viewBox="0 0 1024 1024" aria-hidden="true">
      <path fill="currentColor" d="M838.954667 234.666667H170.666667c-3.626667 0-7.168 0.448-10.56 1.322666l323.690666 323.669334a21.333333 21.333333 0 0 0 30.165334 0L838.954667 234.666667z m46.144 14.186666l-260.693334 260.693334 262.933334 262.912c5.44-7.168 8.661333-16.106667 8.661333-25.792V277.333333c0-10.944-4.117333-20.906667-10.88-28.48zM843.861333 789.333333l-249.6-249.621333-50.133333 50.133333a64 64 0 0 1-90.517333 0l-50.112-50.133333L156.373333 786.88c4.48 1.578667 9.28 2.453333 14.314667 2.453333h673.194667zM128.661333 754.218667L373.333333 509.525333 129.578667 265.813333A42.709333 42.709333 0 0 0 128 277.333333v469.333334c0 2.56 0.213333 5.098667 0.661333 7.552zM170.666667 192h682.666666a85.333333 85.333333 0 0 1 85.333334 85.333333v469.333334a85.333333 85.333333 0 0 1-85.333334 85.333333H170.666667a85.333333 85.333333 0 0 1-85.333334-85.333333V277.333333a85.333333 85.333333 0 0 1 85.333334-85.333333z"/>
    </svg>
  )
  const phoneIco = (
    <svg className="contact__ico" viewBox="0 0 1024 1024" aria-hidden="true">
      <path fill="currentColor" d="M957.9 752.8c-3.3-9.7-9.6-17.4-17.5-22.7l-137.8-91.9c-6.9-4.5-15-7.3-23.8-7.5h-1c-8.4 0-16.3 2.3-23 6.4l-99 59.4c-12.3 5.8-25.1 8.6-38.6 8.6-52.7 0-114.7-42.8-186.1-114.2-89.5-89.5-134.1-164.3-105.5-224.6l59.4-99.1c4.2-7 6.5-15.3 6.4-24.1-0.2-8.8-3-16.9-7.5-23.8L292 81.7c-5.2-7.9-13-14.2-22.7-17.5-4.8-1.7-9.7-2.4-14.5-2.4-4.9 0-9.6 0.8-14.1 2.3L178.2 85c-118 49.8-231.3 274.8 126.4 632.6C486 898.9 633.3 959.2 740.9 959.2c104.7 0 171.8-57.1 196.4-115.3l20.8-62.4c2.9-9 3.1-19-0.2-28.7zM920.6 769l-20.5 61.4c-18.5 41.6-70.8 89.4-159.3 89.4-81.3 0-218.1-39.9-408.4-230.1-228.7-228.9-239.8-381-226-451.4 10.6-54.1 42.4-97.4 85.3-116.4l61.4-20.5c0.6-0.2 1.1-0.3 1.7-0.3l1.8 0.3c1.1 0.3 1.9 1 2.6 2l91.9 137.9c0.6 0.8 0.8 1.7 0.8 2.4 0 1.2-0.2 2.2-0.8 3.1l-59.4 99.1-1 1.7-0.8 1.7c-44.5 93.8 37.2 193.3 113.3 269.4 87 87 153 125.7 214 125.7 19.5 0 38.2-4.2 55.5-12.4l1.7-0.8 1.6-1 99.1-59.4c0.8-0.5 1.7-0.7 2.8-0.7 1.1 0 2 0.3 2.9 0.9l137.7 91.8c1 0.7 1.7 1.6 2.1 2.7 0.4 1.2 0.4 2.3 0 3.5z"/>
    </svg>
  )

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
          <span className="contact__mail-row">
            {mailIco}
            <span className="contact__mail-text"><Editable k="contact-mail" fallback="1205898527@qq.com" /></span>
            {copied === 'mail-1' && <span className="contact__copied">已复制</span>}
          </span>
        </button>
        <button
          type="button"
          className="contact__mail contact__mail--dup st"
          style={{ '--d': '340ms' }}
          onClick={(e) => copy(e, 'mail-2')}
          aria-label="复制电话"
        >
          <span className="contact__mail-row">
            {phoneIco}
            <span className="contact__mail-text"><Editable k="contact-mail-2" fallback="183 1738 9976" /></span>
            {copied === 'mail-2' && <span className="contact__copied">已复制</span>}
          </span>
        </button>
      </div>
    </main>
  )
}
