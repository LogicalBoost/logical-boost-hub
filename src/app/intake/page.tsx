'use client'

import { useState } from 'react'

const mockQuestions = [
  {
    id: '1',
    section: 'Your Best Customers',
    question: 'Think about your last 5 favorite customers — the ones you wish you could clone. What did they all have in common?',
    answer: 'They were homeowners who had storm damage, were responsive, let us handle the insurance process, and referred their neighbors afterward.',
    sort_order: 1,
  },
  {
    id: '2',
    section: 'Your Best Customers',
    question: 'When someone calls you, what\'s the #1 thing they usually say they need help with?',
    answer: 'They usually say they think they might have roof damage from a recent storm and want someone to come look at it.',
    sort_order: 2,
  },
  {
    id: '3',
    section: 'What Makes People Buy',
    question: 'What\'s the most common reason a lead turns into a paying customer? Is there a specific moment where they decide to go with you?',
    answer: 'When we show them the drone photos of the damage they can\'t see from the ground. That\'s the moment they realize they need to act.',
    sort_order: 3,
  },
  {
    id: '4',
    section: 'What Makes People Buy',
    question: 'What do past customers tell you was the main reason they chose you over other roofers?',
    answer: '',
    sort_order: 4,
  },
  {
    id: '5',
    section: 'Hesitations & Objections',
    question: 'What\'s the #1 reason someone almost hires you but doesn\'t? What holds them back?',
    answer: 'They\'re worried about filing an insurance claim and having their rates go up. Or they got multiple quotes and went with the cheapest.',
    sort_order: 5,
  },
  {
    id: '6',
    section: 'Hesitations & Objections',
    question: 'Have you noticed any common misconceptions people have about roofing or insurance claims that cost them money?',
    answer: '',
    sort_order: 6,
  },
  {
    id: '7',
    section: 'Timing & Urgency',
    question: 'Is there a time of year or specific event that causes a big spike in calls or inquiries?',
    answer: 'Spring hail season (March-May) is our biggest period. Also after any major storm event we see a huge spike for about 2-3 weeks.',
    sort_order: 7,
  },
  {
    id: '8',
    section: 'Timing & Urgency',
    question: 'How long do most people wait between first noticing an issue and actually calling you? What makes them finally pick up the phone?',
    answer: '',
    sort_order: 8,
  },
  {
    id: '9',
    section: 'Competition',
    question: 'When you lose a deal to a competitor, who is it usually and what do they offer that you don\'t?',
    answer: 'Usually the storm chaser crews that come through after big storms. They offer lower prices but they\'re not local and won\'t be around for warranty work.',
    sort_order: 9,
  },
  {
    id: '10',
    section: 'Trust & Proof',
    question: 'What\'s the most impressive stat, result, or story you can share about your work? Something that would make a skeptical homeowner trust you.',
    answer: '',
    sort_order: 10,
  },
]

export default function IntakePage() {
  const [answers, setAnswers] = useState<Record<string, string>>(
    Object.fromEntries(mockQuestions.map((q) => [q.id, q.answer || '']))
  )

  const sections = [...new Set(mockQuestions.map((q) => q.section))]
  const answeredCount = Object.values(answers).filter((a) => a.trim().length > 0).length

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Intake</h1>
          <p className="page-subtitle">
            AI-generated questionnaire to fill knowledge gaps &bull; {answeredCount}/{mockQuestions.length} answered
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <span className={`badge ${answeredCount === mockQuestions.length ? 'badge-approved' : 'badge-pending'}`}>
            {answeredCount === mockQuestions.length ? 'Completed' : 'Pending'}
          </span>
          <button className="btn btn-primary">Save Answers</button>
        </div>
      </div>

      {sections.map((section) => (
        <div key={section} className="card" style={{ marginBottom: 16 }}>
          <div className="card-title" style={{ marginBottom: 16 }}>{section}</div>
          {mockQuestions
            .filter((q) => q.section === section)
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
        <button className="btn btn-secondary">Regenerate Questions</button>
        <button className="btn btn-primary">Save &amp; Refine System</button>
      </div>
    </div>
  )
}
