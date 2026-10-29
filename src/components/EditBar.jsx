import { useEffect, useState } from 'react'
import { setEditing, useEditing, checkTokenValidity, isAdminWorkerConfigured } from '../lib/edits'
import { ADMIN_API_URL } from '../lib/adminConfig'

// Shift+E 只在安全 Worker 的服务端验证成功后开放管理面板。
// 不再使用前端硬编码密码；没有配置 Worker 时明确拒绝进入后台。
export default function EditBar() {
  const editing = useEditing()
  const [askAuth, setAskAuth] = useState(false)
  const [authBusy, setAuthBusy] = useState(false)
  const [authMessage, setAuthMessage] = useState('')

  useEffect(() => {
    const onKey = async (e) => {
      if (!(e.shiftKey && (e.key === 'E' || e.key === 'e'))) return
      e.preventDefault()
      if (editing) {
        setEditing(false)
        return
      }
      setAskAuth(true)
      setAuthMessage('')
      if (!isAdminWorkerConfigured()) {
        setAuthMessage('安全后台尚未完成部署配置，已禁用旧版前端密码验证。请先部署并保护 Cloudflare Worker，再启用管理功能。')
        return
      }
      setAuthBusy(true)
      try {
        const result = await checkTokenValidity()
        if (result.ok) {
          setAskAuth(false)
          setEditing(true)
        } else {
          setAuthMessage('服务端身份验证尚未通过。请先登录 Cloudflare Access，再重试。')
        }
      } catch {
        setAuthMessage('无法连接安全后台。请检查 Cloudflare Access 登录状态和网络。')
      } finally {
        setAuthBusy(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editing])

  const openAccessLogin = () => {
    if (!ADMIN_API_URL) return
    const url = new URL(`${ADMIN_API_URL.replace(/\/+$/, '')}/api/contents`)
    url.searchParams.set('path', 'docs/data/portfolio-data.json')
    window.open(url.toString(), '_blank', 'noopener,noreferrer')
  }

  return (
    <>
      {askAuth && (
        <div
          className="ap-pw-mask"
          onClick={(e) => {
            if (e.target === e.currentTarget) setAskAuth(false)
          }}
        >
          <div className="ap-pw" role="dialog" aria-modal="true" aria-labelledby="admin-auth-title">
            <h3 id="admin-auth-title">后台安全验证</h3>
            <p>{authBusy ? '正在验证服务端身份…' : authMessage}</p>
            {isAdminWorkerConfigured() && (
              <div className="ap-pw__btns">
                <button onClick={() => setAskAuth(false)}>取消</button>
                <button onClick={openAccessLogin}>登录 Cloudflare Access</button>
                <button
                  className="ap-pw__ok"
                  onClick={async () => {
                    setAuthBusy(true)
                    setAuthMessage('')
                    try {
                      const result = await checkTokenValidity()
                      if (result.ok) {
                        setAskAuth(false)
                        setEditing(true)
                      } else {
                        setAuthMessage('身份验证未通过，请完成 Cloudflare Access 登录后重试。')
                      }
                    } catch {
                      setAuthMessage('无法连接安全后台，请检查网络后重试。')
                    } finally {
                      setAuthBusy(false)
                    }
                  }}
                  disabled={authBusy}
                >
                  重新验证
                </button>
              </div>
            )}
            {!isAdminWorkerConfigured() && (
              <div className="ap-pw__btns">
                <button onClick={() => setAskAuth(false)}>关闭</button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
