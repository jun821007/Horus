import { FormEvent, useState } from 'react'
import { loginRequest } from '../lib/api'

type Props = {
  onLoggedIn: (username: string) => void
}

export function LoginScreen({ onLoggedIn }: Props) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const res = await loginRequest(username.trim(), password, remember)
      onLoggedIn(res.username || username.trim())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={(e) => void onSubmit(e)}>
        <h1 className="login-title">主控台</h1>
        <p className="login-desc">請登入後繼續</p>
        <label className="login-label">
          帳號
          <input
            className="login-input"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </label>
        <label className="login-label">
          密碼
          <input
            className="login-input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        <label className="login-remember">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          記住登入（長期有效）
        </label>
        {error ? <p className="login-error">{error}</p> : null}
        <button type="submit" className="btn btn-primary login-btn" disabled={busy}>
          {busy ? '登入中…' : '登入'}
        </button>
      </form>
    </div>
  )
}
