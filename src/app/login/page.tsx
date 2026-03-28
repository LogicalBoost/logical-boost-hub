'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot' | 'reset'>('login')
  const [signupSuccess, setSignupSuccess] = useState(false)
  const [resetEmailSent, setResetEmailSent] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [resetSuccess, setResetSuccess] = useState(false)

  // Check for password reset flow on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('reset') === 'true') {
      // Check if user has a valid session from the reset link
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          setMode('reset')
        }
      })
    }
  }, [])

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

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) {
      setError('Please enter your email address')
      return
    }
    setLoading(true)
    setError('')
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'https://hub.logicalboost.com/login?reset=true',
      })
      if (resetError) {
        setError(resetError.message)
      } else {
        setResetEmailSent(true)
      }
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  async function handleSetNewPassword(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    setLoading(true)
    setError('')
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      })
      if (updateError) {
        setError(updateError.message)
      } else {
        setResetSuccess(true)
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
            {mode === 'login' && 'Sign in to your account'}
            {mode === 'signup' && 'Create your account'}
            {mode === 'forgot' && 'Reset your password'}
            {mode === 'reset' && 'Set a new password'}
          </p>
        </div>

        <div className="card" style={{ padding: 24 }}>
          {/* Signup success */}
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
          ) : resetEmailSent ? (
            /* Forgot password email sent */
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>&#9993;</div>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Check your email</div>
              <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.5 }}>
                We sent a password reset link to <strong>{email}</strong>. Click the link in your email to set a new password.
              </div>
              <button
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => { setMode('login'); setResetEmailSent(false); setError('') }}
              >
                Back to Sign In
              </button>
            </div>
          ) : resetSuccess ? (
            /* Password reset success */
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>&#9989;</div>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Password Updated!</div>
              <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.5 }}>
                Your password has been changed successfully. You can now sign in with your new password.
              </div>
              <button
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => { setMode('login'); setResetSuccess(false); setError('') }}
              >
                Sign In
              </button>
            </div>
          ) : mode === 'reset' ? (
            /* Set new password form */
            <form onSubmit={handleSetNewPassword}>
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

              <div className="form-group">
                <label className="form-label">New Password</label>
                <input
                  type="password"
                  className="form-input"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  required
                  minLength={6}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Confirm Password</label>
                <input
                  type="password"
                  className="form-input"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  required
                  minLength={6}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
                disabled={loading}
              >
                {loading ? 'Updating...' : 'Set New Password'}
              </button>
            </form>
          ) : mode === 'forgot' ? (
            /* Forgot password form */
            <form onSubmit={handleForgotPassword}>
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

              <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.5 }}>
                Enter your email address and we&apos;ll send you a link to reset your password.
              </div>

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

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
                disabled={loading}
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>

              <button
                type="button"
                onClick={() => { setMode('login'); setError('') }}
                style={{
                  width: '100%',
                  marginTop: 12,
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: 13,
                  textDecoration: 'underline',
                }}
              >
                Back to Sign In
              </button>
            </form>
          ) : (
            /* Login / Signup form */
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

              {mode === 'login' && (
                <div style={{ textAlign: 'right', marginTop: -4, marginBottom: 8 }}>
                  <button
                    type="button"
                    onClick={() => { setMode('forgot'); setError('') }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      fontSize: 12,
                      textDecoration: 'underline',
                    }}
                  >
                    Forgot your password?
                  </button>
                </div>
              )}

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
          ) : mode === 'signup' ? (
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
          ) : null}
        </p>
      </div>
    </div>
  )
}
