import { useEffect, useState } from 'react'
import { setEditing, useEditing, useAuthorized, checkPassword } from '../lib/edits'

// 后台入口：Shift+E 唤起。需要输入后台密码，避免访客进入管理面板。
// 同一浏览器会话内验证通过后免重复输入（关闭标签页失效）。
export default function EditBar() {
  const editing = useEditing()
  const authorized = useAuthorized()
  const [askPw, setAskPw] = useState(false)
  const [pw, setPw] = useState('')
  const [wrong, setWrong] = useState(false)

  useEffect(() => {
    const onKey = (e) => {
      if (e.shiftKey && (e.key === 'E' || e.key === 'e')) {
        e.preventDefault()
        if (editing) {
          setEditing(false)
          return
        }
        if (authorized) {
          setEditing(true)
        } else {
          setAskPw(true)
          setPw('')
          setWrong(false)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editing, authorized])

  const submit = () => {
    if (checkPassword(pw)) {
      setAskPw(false)
      setEditing(true)
    } else {
      setWrong(true)
      setPw('')
    }
  }

  return (
    <>
      {askPw && (
        <div
          className="ap-pw-mask"
          onClick={(e) => {
            if (e.target === e.currentTarget) setAskPw(false)
          }}
        >
          <div className="ap-pw">
            <h3>后台管理验证</h3>
            <p>请输入后台密码（仅网站所有者使用）</p>
            <input
              type="password"
              autoFocus
              value={pw}
              placeholder="后台密码"
              onChange={(e) => {
                setPw(e.target.value)
                setWrong(false)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit()
                if (e.key === 'Escape') setAskPw(false)
              }}
            />
            {wrong && <em className="ap-pw__err">密码不正确，请重试</em>}
            <div className="ap-pw__btns">
              <button onClick={() => setAskPw(false)}>取消</button>
              <button className="ap-pw__ok" onClick={submit}>
                进入后台
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  )
}
