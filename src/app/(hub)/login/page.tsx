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
  // Supabase sends recovery links with hash fragments: #access_token=...&type=recovery
  // OR with ?reset=true query param (our custom redirect)
  useEffect(() => {
    // Method 1: Check hash fragment for recovery token (Supabase default flow)
    const hash = window.location.hash
    if (hash) {
      const hashParams = new URLSearchParams(hash.substring(1))
      const type = hashParams.get('type')
      if (type === 'recovery') {
        // Supabase auth client will automatically pick up the token from the hash
        // and establish a session. We just need to wait for it.
        setMode('reset')
        return
      }
    }

    // Method 2: Check query param (our custom redirect from resetPasswordForEmail)
    const params = new URLSearchParams(window.location.search)
    if (params.get('reset') === 'true') {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          setMode('reset')
        }
      })
    }

    // Listen for auth state changes (catches recovery token being processed)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setMode('reset')
      }
    })

    return () => subscription.unsubscribe()
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
          // If email not confirmed, auto-confirm via edge function and retry
          if (authError.message.toLowerCase().includes('email not confirmed')) {
            try {
              const res = await fetch(
                `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/confirm-user`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ email, password }),
                }
              )
              const result = await res.json()
              if (result.session) {
                // Set the session from the edge function response
                await supabase.auth.setSession({
                  access_token: result.session.access_token,
                  refresh_token: result.session.refresh_token,
                })
                // AuthProvider will handle redirect
                return
              } else {
                setError(result.error || 'Login failed')
              }
            } catch {
              setError('Login failed. Please try again.')
            }
          } else {
            setError(authError.message)
          }
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
        // Password updated — user already has a session from recovery flow.
        // Clean URL params and redirect based on role.
        // Fetch the user's profile to determine correct destination.
        window.history.replaceState({}, '', '/login/')
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (authUser) {
          const { data: userProfile } = await supabase
            .from('users')
            .select('role')
            .eq('id', authUser.id)
            .single()
          if (userProfile?.role === 'client') {
            window.location.href = '/client/dashboard/'
          } else {
            window.location.href = '/dashboard/'
          }
        } else {
          window.location.href = '/dashboard/'
        }
        return
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
