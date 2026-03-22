'use client'

import { useState } from 'react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { signIn } = await import('@/lib/supabase')
      const { error: authError } = await signIn(email, password)
      if (authError) {
        setError(authError.message)
      } else {
        window.location.href = '/logical-boost-hub/dashboard'
      }
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-primary)',
      zIndex: 9999,
    }}>
      <div style={{ width: '100%', maxWidth: 400, padding: 20 }}>
        <div style={{ textAlign: 'center' as const, marginBottom: 32 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
            <span style={{ color: 'var(--accent)' }}>Logical</span> Boost Hub
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Sign in to your account</p>
        </div>

        <div className="card" style={{ padding: 24 }}>
          <form onSubmit={handleLogin}>
            {error && (
              <div style={{
                background: 'var(--danger-muted)',
                color: 'var(--danger)',
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                fontSize: 14,
                marginBottom: 16,
              }}>
                {error}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                type="email"
                className="form-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center' as const, marginTop: 16, fontSize: 13, color: 'var(--text-muted)' }}>
          Demo mode: Use any credentials or browse without signing in
        </p>
      </div>
    </div>
  )
}
