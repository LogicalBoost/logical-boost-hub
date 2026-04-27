'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // Self-serve sign-up has been removed. New users land in the system via
  // an admin-issued invite flow (invite-user edge function -> password set).
  const [mode, setMode] = useState<'login' | 'forgot' | 'reset'>('login')
  const [resetEmailSent, setResetEmailSent] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [resetSuccess, setResetSuccess] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)

  // Check for password reset flow on mount
  // Supabase sends recovery links with hash fragments: #access_token=...&type=recovery
  // OR with ?reset=true query param (our custom redirect)
  useEffect(() => {
    let isRecoveryFlow = false

    // Method 1: Check hash fragment for recovery token (Supabase default flow)
    const hash = window.location.hash
    if (hash) {
      const hashParams = new URLSearchParams(hash.substring(1))
      const type = hashParams.get('type')
      if (type === 'recovery') {
        isRecoveryFlow = true
        setMode('reset')
      }
    }

    // Method 2: Check query param (our custom redirect from resetPasswordForEmail)
    const params = new URLSearchParams(window.location.search)
    if (params.get('reset') === 'true') {
      isRecoveryFlow = true
      setMode('reset')
    }

    // Listen for auth state changes (catches recovery token being processed)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setMode('reset')
        if (session) {
          setSessionReady(true)
        }
      }
      // Also catch SIGNED_IN which happens when recovery token is exchanged
      if (event === 'SIGNED_IN' && session && isRecoveryFlow) {
        setSessionReady(true)
      }
    })

    // If this is a recovery flow, also poll for session (backup in case event was missed)
    if (isRecoveryFlow) {
      const checkSession = async () => {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          setSessionReady(true)
        } else {
          // Retry after a short delay — token exchange can take a moment
          setTimeout(async () => {
            const { data: { session: retrySession } } = await supabase.auth.getSession()
            if (retrySession) {
              setSessionReady(true)
            }
          }, 2000)
        }
      }
      // Small delay to let Supabase process the hash tokens
      setTimeout(checkSession, 500)
    }

    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // Sign-in is the only direct-form action left. Sign-up is invite-only.
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (authError) {
        // If email not confirmed, auto-confirm via edge function and retry.
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
              await supabase.auth.setSession({
                access_token: result.session.access_token,
                refresh_token: result.session.refresh_token,
              })
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
      // AuthProvider will handle the redirect on success.
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
      // Verify we have an active session before attempting password update
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setError('Your reset link has expired or is invalid. Please request a new password reset.')
        setLoading(false)
        return
      }
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
            {mode === 'forgot' && 'Reset your password'}
            {mode === 'reset' && 'Set a new password'}
          </p>
        </div>

        <div className="card" style={{ padding: 24 }}>
          {resetEmailSent ? (
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
            !sessionReady ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: 28, marginBottom: 12 }}>&#9881;&#65039;</div>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Verifying your reset link...</div>
                <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Please wait while we verify your identity.
                </div>
              </div>
            ) : (
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
            )
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
            /* Sign-in form */
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
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          )}
        </div>

        <p style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: 'var(--text-muted)' }}>
          Need an account? Contact your account manager.
        </p>
      </div>
    </div>
  )
}
