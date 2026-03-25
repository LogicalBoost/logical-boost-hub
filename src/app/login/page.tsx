'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [signupSuccess, setSignupSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSignupSuccess(false)

    try {
      if (mode === 'login') {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (authError) {
          setError(authError.message)
        }
        // AuthProvider will handle the redirect on success
      } else {
        const { error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name: name || email.split('@')[0] },
          },
        })
        if (authError) {
          setError(authError.message)
        } else {
          setSignupSuccess(true)
        }
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
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
            <span style={{ color: 'var(--accent)' }}>Logical</span> Boost Hub
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            {mode === 'login' ? 'Sign in to your account' : 'Create your account'}
          </p>
        </div>

        <div className="card" style={{ padding: 24 }}>
          {signupSuccess ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>&#9989;</div>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Account Created!</div>
              <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.5 }}>
                Check your email for a confirmation link, then sign in.
              </div>
              <button
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => { setMode('login'); setSignupSuccess(false) }}
              >
                Go to Sign In
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {error && (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  color: '#ef4444',
                  padding: '10px 14px',
                  borderRadius: 6,
                  fontSize: 14,
                  marginBottom: 16,
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                }}>
                  {error}
                </div>
              )}

              {mode === 'signup' && (
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                  />
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
                  placeholder={mode === 'signup' ? 'At least 6 characters' : 'Enter your password'}
                  required
                  minLength={mode === 'signup' ? 6 : undefined}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
                disabled={loading}
              >
                {loading
                  ? (mode === 'login' ? 'Signing in...' : 'Creating account...')
                  : (mode === 'login' ? 'Sign In' : 'Create Account')
                }
              </button>
            </form>
          )}
        </div>

        <p style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: 'var(--text-muted)' }}>
          {mode === 'login' ? (
            <>
              Don&apos;t have an account?{' '}
              <button
                onClick={() => { setMode('signup'); setError('') }}
                style={{
                  background: 'none', border: 'none', color: 'var(--accent)',
                  cursor: 'pointer', fontSize: 13, textDecoration: 'underline',
                }}
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                onClick={() => { setMode('login'); setError('') }}
                style={{
                  background: 'none', border: 'none', color: 'var(--accent)',
                  cursor: 'pointer', fontSize: 13, textDecoration: 'underline',
                }}
              >
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  )
}
