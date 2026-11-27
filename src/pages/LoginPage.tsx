import { useState, type FormEvent } from 'react'
import { supabase, isConfigured } from '../lib/supabase'
import { errorMessage } from '../lib/format'
import { SHOP_NAME } from '../config'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) setError(errorMessage(error))
    setLoading(false)
    // Đăng nhập thành công: AuthProvider tự chuyển vào màn hình chính
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-teal-700 p-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h1 className="text-center text-2xl font-bold text-teal-700">{SHOP_NAME}</h1>
        <p className="mt-1 mb-6 text-center text-slate-500">Đăng nhập để bán hàng</p>

        {!isConfigured && (
          <div className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
            Chưa cấu hình kết nối Supabase. Hãy tạo file <b>.env</b> (xem README).
          </div>
        )}

        <label className="label" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          className="input mb-4"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <label className="label" htmlFor="password">
          Mật khẩu
        </label>
        <input
          id="password"
          type="password"
          className="input mb-4"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error && <div className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <button type="submit" className="btn btn-primary w-full" disabled={loading}>
          {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </button>
      </form>
    </div>
  )
}
