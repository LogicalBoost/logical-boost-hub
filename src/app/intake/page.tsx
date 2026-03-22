'use client'

import { useState } from 'react'
import { MOCK_INTAKE_QUESTIONS } from '@/lib/mock-data'
import { demoAction, showToast } from '@/lib/demo-toast'

export default function IntakePage() {
  const [questions] = useState(MOCK_INTAKE_QUESTIONS)
  const [answers, setAnswers] = useState<Record<string, string>>(
    Object.fromEntries(questions.map((q) => [q.id, '']))
  )

  const sections = [...new Set(questions.map((q) => q.section))]
  const answeredCount = Object.values(answers).filter((a) => a.trim().length > 0).length
  const totalCount = questions.length
  const progressPercent = totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0

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
          <button className="btn btn-primary" onClick={() => showToast('Answers saved successfully')}>
            Save Answers
          </button>
        </div>
      </div>

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

      {sections.map((section) => (
        <div key={section} className="card" style={{ marginBottom: 16 }}>
          <div className="card-title" style={{ marginBottom: 16 }}>{section}</div>
          {questions
            .filter((q) => q.section === section)
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((q) => (
              <div key={q.id} className="form-group">
                <label className="form-label">{q.question}</label>
                <textarea
                  className="form-input form-textarea"
                  value={answers[q.id]}
                  onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                  placeholder="Type your answer here..."
                />
              </div>
            ))}
        </div>
      ))}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 24 }}>
        <button
          className="btn btn-secondary"
          onClick={() => demoAction('Regenerate Intake Questions with AI')}
        >
          Regenerate Questions
        </button>
        <button
          className="btn btn-primary"
          onClick={() => demoAction('Refine System with AI — updates avatars and offers based on your answers')}
        >
          Save &amp; Refine System
        </button>
      </div>
    </div>
  )
}
