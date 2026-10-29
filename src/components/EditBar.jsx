import { useEffect, useState } from 'react'
import { setEditing, useEditing, useAuthorized, checkPassword, isAdminWorkerConfigured, clearAdminAuth, getAdminSession } from '../lib/edits'

// 后台入口：Shift+E 唤起。workerMode 下输入后台密码（密码由服务端校验，前端无明文）；
// 未配置 Worker（旧 PAT 过渡期）仅确认框防误入。
// 同一浏览器会话内验证通过后免重复输入（关闭标签页失效）。
export default function EditBar() {
  const editing = useEditing()
  const authorized = useAuthorized()
  const [askPw, setAskPw] = useState(false)
  const [pw, setPw] = useState('')
  const [wrong, setWrong] = useState(false)

  // 服务端会话失效（401）：关闭后台并清除授权，下次 Shift+E 重新验证
  useEffect(() => {
    const onExpired = () => {
      clearAdminAuth()
      setEditing(false)
      setAskPw(false)
    }
    window.addEventListener('admin-auth-expired', onExpired)
    return () => window.removeEventListener('admin-auth-expired', onExpired)
  }, [])

  useEffect(() => {
    const onKey = (e) => {
      if (e.shiftKey && (e.key === 'E' || e.key === 'e')) {
        e.preventDefault()
        if (editing) {
          setEditing(false)
          return
        }
        if (isAdminWorkerConfigured()) {
          // Worker 模式：必须有服务端会话才能进入（旧授权标记但无会话 → 重新输密码）
          if (authorized && getAdminSession()) {
            setEditing(true)
          } else {
            setAskPw(true)
            setPw('')
            setWrong(false)
          }
        } else if (authorized) {
          setEditing(true)
        } else {
          // 未配置 Worker（旧 PAT 过渡期）：前端无明文密码，仅确认框防误入
          if (window.confirm('进入后台管理？\n\n（服务端密码尚未启用，此确认仅防止误入）')) {
            setEditing(true)
          }
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editing, authorized])

  const submit = async () => {
    const r = await checkPassword(pw)
    if (r === true) {
      setAskPw(false)
      setEditing(true)
    } else if (r === 'not-enabled') {
      setWrong(true)
      setPw('')
      setAskPw(false)
      // 服务端未启用密码登录：引导使用 Cloudflare Access
      window.alert('服务端尚未启用密码登录。请先配置 Cloudflare Access 登录，或联系部署方设置 ADMIN_PASSWORD。')
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
