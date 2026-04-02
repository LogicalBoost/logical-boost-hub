'use client'

import { useState, useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import { generateIntake, refineSystem } from '@/lib/api'
import { showToast } from '@/lib/demo-toast'
import { supabase } from '@/lib/supabase'

export default function IntakePage() {
  const { client, intakeQuestions, refreshIntake, loadClientData, setLoading, loading, canEdit, isClientRole } = useAppStore()
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [loadingMessage, setLoadingMessage] = useState('')

  // Sync local answers state when intakeQuestions change
  useEffect(() => {
    if (intakeQuestions.length > 0) {
      const initial: Record<string, string> = {}
      for (const q of intakeQuestions) {
        initial[q.id] = q.answer || ''
      }
      setAnswers(initial)
    }
  }, [intakeQuestions])

  const sections = [...new Set(intakeQuestions.map((q) => q.section))]
  const answeredCount = intakeQuestions.filter((q) => {
    const localAnswer = answers[q.id]
    return (localAnswer ?? q.answer ?? '').trim().length > 0
  }).length
  const totalCount = intakeQuestions.length
  const progressPercent = totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0

  async function handleGenerateIntake() {
    if (!client) return
    setLoading(true)
    setLoadingMessage('AI is generating targeted questions...')
    try {
      const result = await generateIntake(client.id)
      await refreshIntake(client.id)
      if (result.questions_created > 0) {
        showToast(`${result.questions_created} intake questions generated`)
      } else {
        showToast('No questions were generated. Try again.')
      }
    } catch (err) {
      showToast(`Error: ${(err as Error).message}`)
    } finally {
      setLoading(false)
      setLoadingMessage('')
    }
  }

  async function saveAnswers() {
    const changed = Object.entries(answers).filter(([id, answer]) => {
      const q = intakeQuestions.find((q) => q.id === id)
      return q && answer !== (q.answer || '')
    })
    if (changed.length === 0) {
      showToast('No changes to save')
      return
    }
    for (const [id, answer] of changed) {
      await supabase.from('intake_questions').update({ answer }).eq('id', id)
    }
    if (client) {
      await refreshIntake(client.id)
    }
    showToast('Answers saved successfully')
  }

  async function handleSaveAnswers() {
    setLoading(true)
    try {
      await saveAnswers()
    } catch (err) {
      showToast(`Error: ${(err as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveAndRefine() {
    if (!client) return
    setLoading(true)
    try {
      await saveAnswers()
      setLoadingMessage('AI is refining your avatars and offers...')
      await refineSystem(client.id)
      await loadClientData(client.id)
      showToast('System refined — avatars and offers updated')
    } catch (err) {
      showToast(`Error: ${(err as Error).message}`)
    } finally {
      setLoading(false)
      setLoadingMessage('')
    }
  }

  // Empty state: no client
  if (!client) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">&#128203;</div>
        <div className="empty-state-text">No client selected</div>
        <div className="empty-state-sub">Set up your client first in Business Overview.</div>
      </div>
    )
  }

  // No intake questions yet
  if (intakeQuestions.length === 0) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">Intake</h1>
            <p className="page-subtitle">
              AI-generated questionnaire to fill knowledge gaps
            </p>
          </div>
        </div>
        <div className="empty-state">
          <div className="empty-state-icon">&#128221;</div>
          <div className="empty-state-text">No intake questions yet</div>
          <div className="empty-state-sub">
            {isClientRole
              ? 'Your agency team will set up intake questions for your account.'
              : 'Generate targeted questions based on your client profile.'}
          </div>
          {canEdit && (
            <button
              className="btn btn-primary"
              onClick={handleGenerateIntake}
              disabled={loading}
              style={{ marginTop: 16 }}
            >
              {loading ? loadingMessage || 'Generating...' : 'Generate Intake Questions'}
            </button>
          )}
        </div>
      </div>
    )
  }

  // Intake questions exist
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Intake</h1>
          <p className="page-subtitle">
            AI-generated questionnaire to fill knowledge gaps &bull; {answeredCount}/{totalCount} answered
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <span className={`badge ${answeredCount === totalCount ? 'badge-approved' : 'badge-pending'}`}>
            {answeredCount === totalCount ? 'Completed' : 'Pending'}
          </span>
          {canEdit && (
            <button
              className="btn btn-primary"
              onClick={handleSaveAnswers}
              disabled={loading}
            >
              Save Answers
            </button>
          )}
        </div>
      </div>

      {/* Loading message overlay */}
      {loading && loadingMessage && (
        <div className="card" style={{ marginBottom: 16, padding: '12px 20px', textAlign: 'center' }}>
          {loadingMessage}
        </div>
      )}

      {/* Progress bar */}
      <div className="card" style={{ marginBottom: 16, padding: '12px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 14 }}>
          <span>Progress</span>
          <span>{progressPercent}%</span>
        </div>
        <div style={{ width: '100%', height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.1)' }}>
          <div
            style={{
              width: `${progressPercent}%`,
              height: '100%',
              borderRadius: 4,
              background: progressPercent === 100 ? '#22c55e' : '#6366f1',
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      </div>

      {/* Questions grouped by section */}
      {sections.map((section) => (
        <div key={section} className="card" style={{ marginBottom: 16 }}>
          <div className="card-title" style={{ marginBottom: 16 }}>{section}</div>
          {intakeQuestions
            .filter((q) => q.section === section)
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((q) => (
              <div key={q.id} className="form-group">
                <label className="form-label">{q.question}</label>
                {isClientRole ? (
                  <div style={{
                    padding: '10px 14px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 14,
                    color: (answers[q.id] ?? '').trim() ? 'var(--text-primary)' : 'var(--text-muted)',
                    minHeight: 40,
                    whiteSpace: 'pre-wrap',
                  }}>
                    {(answers[q.id] ?? '').trim() || 'Not answered yet'}
                  </div>
                ) : (
                  <textarea
                    className="form-input form-textarea"
                    value={answers[q.id] ?? ''}
                    onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                    placeholder="Type your answer here..."
                  />
                )}
              </div>
            ))}
        </div>
      ))}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 24 }}>
        {canEdit && (
          <button
            className="btn btn-secondary"
            onClick={handleGenerateIntake}
            disabled={loading}
          >
            Regenerate Questions
          </button>
        )}
        {canEdit && (
          <button
            className="btn btn-primary"
            onClick={handleSaveAndRefine}
            disabled={loading}
          >
            {loading && loadingMessage ? loadingMessage : 'Save & Refine System'}
          </button>
        )}
      </div>
    </div>
  )
}
