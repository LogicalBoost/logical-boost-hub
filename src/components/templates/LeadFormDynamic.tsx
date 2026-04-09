'use client'

import { useState, useEffect, useCallback } from 'react'
import type { FormConfig, FormFieldDef } from './types'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''

interface Props {
  formConfig: FormConfig
  pageSlug?: string
  clientSlug?: string
  publishedPageId?: string
  embedded?: boolean
  darkBg?: boolean
}

export default function LeadFormDynamic({ formConfig, pageSlug, clientSlug, publishedPageId, embedded, darkBg }: Props) {
  const { fields, steps, settings, form_type } = formConfig
  const isMultiStep = form_type === 'multi_step' && steps && steps.length > 0

  const [formData, setFormData] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [currentStep, setCurrentStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // UTM + tracking data (captured on mount)
  const [utm, setUtm] = useState<Record<string, string | null>>({})
  const [referrer, setReferrer] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    setUtm({
      utm_source: params.get('utm_source'),
      utm_medium: params.get('utm_medium'),
      utm_campaign: params.get('utm_campaign'),
      utm_content: params.get('utm_content'),
      utm_term: params.get('utm_term'),
    })
    setReferrer(document.referrer || null)
  }, [])

  const handleChange = useCallback((name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }))
    setErrors(prev => {
      const next = { ...prev }
      delete next[name]
      return next
    })
  }, [])

  // Get fields for current step (or all fields for standard)
  const currentFields: FormFieldDef[] = isMultiStep
    ? steps![currentStep].field_ids
        .map(fid => fields.find(f => f.id === fid))
        .filter((f): f is FormFieldDef => f !== undefined)
    : fields.filter(f => f.type !== 'hidden')

  const hiddenFields = fields.filter(f => f.type === 'hidden')

  // Validate current step/form
  const validate = useCallback((fieldsToValidate: FormFieldDef[]): boolean => {
    const newErrors: Record<string, string> = {}
    for (const field of fieldsToValidate) {
      if (field.type === 'hidden') continue
      const val = (formData[field.name] || '').trim()
      if (field.required && !val) {
        newErrors[field.name] = `${field.label} is required`
        continue
      }
      if (val && field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
        newErrors[field.name] = 'Enter a valid email address'
      }
      if (val && field.type === 'phone' && !/^[+\d\s\-().]{7,20}$/.test(val)) {
        newErrors[field.name] = 'Enter a valid phone number'
      }
      if (val && field.validation?.min_length && val.length < field.validation.min_length) {
        newErrors[field.name] = `Minimum ${field.validation.min_length} characters`
      }
      if (val && field.validation?.max_length && val.length > field.validation.max_length) {
        newErrors[field.name] = `Maximum ${field.validation.max_length} characters`
      }
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [formData])

  const handleNext = () => {
    if (validate(currentFields)) {
      setCurrentStep(prev => Math.min(prev + 1, (steps?.length || 1) - 1))
    }
  }

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate(currentFields)) return

    setSubmitting(true)
    setSubmitError(null)

    // Include hidden fields
    const fullData = { ...formData }
    for (const hf of hiddenFields) {
      if (hf.placeholder) fullData[hf.name] = hf.placeholder // hidden fields use placeholder as value
    }

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/submit-form`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          form_id: formConfig.id,
          published_page_id: publishedPageId || null,
          form_data: fullData,
          page_slug: pageSlug || null,
          client_slug: clientSlug || null,
          page_url: typeof window !== 'undefined' ? window.location.href : null,
          utm,
          referrer,
          user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || `Submission failed (${res.status})`)
      }

      setSubmitted(true)

      // Redirect if configured
      if (settings.redirect_url) {
        setTimeout(() => {
          window.location.href = settings.redirect_url!
        }, 1500)
      }
    } catch (err) {
      setSubmitError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  // Success state
  if (submitted) {
    if (embedded) {
      return (
        <div className="text-center py-8">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ${darkBg ? 'bg-white/15' : 'bg-[var(--color-primary)]/10'}`}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={darkBg ? 'white' : 'var(--color-primary)'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
          </div>
          <h3 className={`text-lg font-bold mb-1 ${darkBg ? 'text-white' : 'text-[var(--color-text)]'}`} style={{ fontFamily: 'var(--font-heading)' }}>
            {settings.success_message || 'Thank you!'}
          </h3>
          <p className={`text-sm ${darkBg ? 'text-white/60' : 'text-gray-500'}`}>We&apos;ll be in touch shortly.</p>
        </div>
      )
    }
    return (
      <section id="lead-form" className="py-16 md:py-20 bg-gray-50">
        <div className="max-w-xl mx-auto px-4 text-center">
          <div className="bg-white rounded-2xl shadow-lg p-10 md:p-14">
            <div className="text-5xl mb-4">&#10003;</div>
            <h3 className="text-2xl font-bold text-[var(--color-text)] mb-3" style={{ fontFamily: 'var(--font-heading)' }}>
              {settings.success_message || 'Thank you! We\'ll be in touch shortly.'}
            </h3>
          </div>
        </div>
      </section>
    )
  }

  const totalSteps = steps?.length || 1
  const isLastStep = !isMultiStep || currentStep === totalSteps - 1
  const submitText = settings.submit_button_text || 'Submit'
  const nextText = settings.next_button_text || 'Next'
  const backText = settings.back_button_text || 'Back'

  // Style variants for dark (branded) form background
  const fieldCls = darkBg
    ? 'bg-white/15 backdrop-blur-md border-white/25 text-white placeholder-white/60 focus:border-white/50 focus:ring-white/20'
    : 'bg-white/80 border-gray-200 text-gray-800 focus:border-[var(--color-primary)] focus:ring-[var(--color-primary)]/20'
  const labelCls = darkBg
    ? 'text-white/80'
    : 'text-gray-500'
  const errorCls = darkBg ? 'text-red-300' : 'text-red-500'
  const stepTextCls = darkBg ? 'text-white/50' : 'text-gray-400'
  const trustTextCls = darkBg ? 'text-white/40' : 'text-gray-400'

  if (embedded) {
    return (
      <div>
        {/* Multi-step progress — segmented pill bar (hidden on mobile to save space) */}
        {isMultiStep && settings.show_progress_bar !== false && (
          <div className="mb-4 hidden md:block">
            <div className="flex gap-1 mb-1.5">
              {steps!.map((_step, i) => (
                <div
                  key={i}
                  className="flex-1 h-1 rounded-full transition-all duration-300"
                  style={{
                    background: i <= currentStep ? (darkBg ? 'rgba(255,255,255,0.9)' : 'var(--color-primary)') : (darkBg ? 'rgba(255,255,255,0.2)' : '#e5e7eb'),
                    opacity: i < currentStep ? 0.5 : 1,
                  }}
                />
              ))}
            </div>
            <p className={`text-[11px] font-medium uppercase tracking-wider ${stepTextCls}`}>
              Step {currentStep + 1} of {totalSteps}
            </p>
          </div>
        )}

        <form onSubmit={isLastStep ? handleSubmit : (e) => { e.preventDefault(); handleNext() }}>
          <div className="grid grid-cols-2 gap-2.5">
            {currentFields.map((field) => (
              <div
                key={field.id}
                className={field.width === 'half' ? 'col-span-1' : 'col-span-2'}
              >
                {field.type !== 'checkbox' && field.type !== 'radio' && (
                  <label className={`hidden md:block text-xs font-semibold uppercase tracking-wider mb-1 ${labelCls}`}>
                    {field.label}
                    {field.required && <span className={`ml-0.5 ${darkBg ? 'text-red-300' : 'text-red-500'}`}>*</span>}
                  </label>
                )}

                {field.type === 'radio' ? (
                  <fieldset>
                    <legend className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${labelCls}`}>
                      {field.label}
                      {field.required && <span className={`ml-0.5 ${darkBg ? 'text-red-300' : 'text-red-500'}`}>*</span>}
                    </legend>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(field.options || []).map((opt) => (
                        <label key={opt.value} className={`cursor-pointer px-2.5 py-1.5 rounded-lg border text-center transition-all text-[13px] font-medium ${
                          formData[field.name] === opt.value
                            ? (darkBg ? 'border-white/40 bg-white/25 text-white shadow-sm' : 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white shadow-sm')
                            : (darkBg ? 'border-white/20 bg-white/10 text-white/80 hover:border-white/30 hover:bg-white/15' : 'border-gray-200 bg-gray-50/80 text-gray-600 hover:border-gray-300 hover:bg-gray-100')
                        }`}>
                          <input
                            type="radio" name={field.name} value={opt.value}
                            checked={formData[field.name] === opt.value}
                            onChange={(e) => handleChange(field.name, e.target.value)}
                            className="sr-only"
                          />
                          {opt.label}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                ) : field.type === 'number' ? (
                  <input type="number" name={field.name} value={formData[field.name] || ''}
                    onChange={(e) => handleChange(field.name, e.target.value)}
                    placeholder={field.placeholder || field.label || ''}
                    className={`w-full px-3 py-2.5 rounded-lg border outline-none transition text-sm focus:ring-2 ${errors[field.name] ? 'border-red-400' : ''} ${fieldCls}`}
                  />
                ) : field.type === 'textarea' ? (
                  <textarea name={field.name} value={formData[field.name] || ''}
                    onChange={(e) => handleChange(field.name, e.target.value)}
                    placeholder={field.placeholder || field.label || ''} rows={3}
                    className={`w-full px-3 py-2.5 rounded-lg border outline-none transition text-sm focus:ring-2 ${errors[field.name] ? 'border-red-400' : ''} ${fieldCls}`}
                  />
                ) : field.type === 'select' ? (
                  <select name={field.name} value={formData[field.name] || ''}
                    onChange={(e) => handleChange(field.name, e.target.value)}
                    className={`w-full px-3 py-2.5 rounded-lg border outline-none transition text-sm focus:ring-2 ${errors[field.name] ? 'border-red-400' : ''} ${fieldCls}`}
                  >
                    <option value="">{field.placeholder || field.label || 'Select...'}</option>
                    {(field.options || []).map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                ) : field.type === 'checkbox' ? (
                  <label className="flex items-start gap-2 cursor-pointer py-0.5">
                    <input type="checkbox" checked={formData[field.name] === 'true'}
                      onChange={(e) => handleChange(field.name, e.target.checked ? 'true' : '')}
                      className={`mt-0.5 w-4 h-4 rounded ${darkBg ? 'border-white/40 text-white' : 'border-gray-300 text-[var(--color-primary)]'} focus:ring-[var(--color-primary)]`}
                    />
                    <span className={`text-sm ${darkBg ? 'text-white/80' : 'text-gray-600'}`}>
                      {field.label}{field.required && <span className={`ml-0.5 ${darkBg ? 'text-red-300' : 'text-red-500'}`}>*</span>}
                    </span>
                  </label>
                ) : (
                  <input
                    type={field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : 'text'}
                    name={field.name} value={formData[field.name] || ''}
                    onChange={(e) => handleChange(field.name, e.target.value)}
                    placeholder={field.placeholder || field.label || ''}
                    className={`w-full px-3 py-2.5 rounded-lg border outline-none transition text-sm focus:ring-2 ${errors[field.name] ? 'border-red-400' : ''} ${fieldCls}`}
                  />
                )}

                {errors[field.name] && (
                  <p className={`text-xs mt-0.5 ${errorCls}`}>{errors[field.name]}</p>
                )}
              </div>
            ))}
          </div>

          {submitError && (
            <div className={`mt-2 p-2 rounded-lg text-xs ${darkBg ? 'bg-red-500/20 border border-red-400/30 text-red-200' : 'bg-red-50 border border-red-200 text-red-700'}`}>{submitError}</div>
          )}

          <div className={`mt-3 md:mt-4 flex ${isMultiStep && currentStep > 0 ? 'gap-2.5' : 'flex-col items-center'}`}>
            {isMultiStep && currentStep > 0 && (
              <button type="button" onClick={handleBack}
                className={`px-4 py-2.5 rounded-lg border font-semibold transition text-sm ${darkBg ? 'border-white/25 text-white/80 hover:bg-white/10' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
              >{backText}</button>
            )}
            <button
              type="submit" disabled={submitting}
              className={`btn-textured py-3 rounded-[var(--button-radius)] font-bold text-sm transition-all disabled:opacity-60 w-full shadow-lg hover:shadow-xl ${
                darkBg ? 'bg-white text-[var(--color-primary)] hover:bg-gray-50' : 'cta-button'
              }`}
            >
              {submitting ? 'Submitting...' : isLastStep ? submitText : nextText}
            </button>
          </div>

          {/* Trust micro-copy */}
          <p className={`text-center text-[10px] mt-2 flex items-center justify-center gap-1 ${trustTextCls}`}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
            Secure &amp; confidential
          </p>
        </form>
      </div>
    )
  }

  return (
    <section id="lead-form" className="py-16 md:py-20 bg-gray-50">
      <div className="max-w-xl mx-auto px-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 md:p-10">

          {/* Multi-step progress bar */}
          {isMultiStep && settings.show_progress_bar !== false && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-2">
                {steps!.map((step, i) => (
                  <div key={i} className="flex items-center flex-1">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                        i < currentStep
                          ? 'bg-[var(--color-primary)] text-white'
                          : i === currentStep
                            ? 'bg-[var(--color-primary)] text-white'
                            : 'bg-gray-200 text-gray-500'
                      }`}
                    >
                      {i < currentStep ? '✓' : i + 1}
                    </div>
                    {i < totalSteps - 1 && (
                      <div className={`flex-1 h-1 mx-2 rounded transition-colors ${
                        i < currentStep ? 'bg-[var(--color-primary)]' : 'bg-gray-200'
                      }`} />
                    )}
                  </div>
                ))}
              </div>
              <p className="text-center text-sm font-semibold text-[var(--color-text)]">
                {steps![currentStep].name}
              </p>
            </div>
          )}

          <form onSubmit={isLastStep ? handleSubmit : (e) => { e.preventDefault(); handleNext() }}>
            {/* Fields */}
            <div className="grid grid-cols-2 gap-4">
              {currentFields.map((field) => (
                <div
                  key={field.id}
                  className={field.width === 'half' ? 'col-span-1' : 'col-span-2'}
                >
                  {field.type !== 'checkbox' && field.type !== 'radio' && (
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      {field.label}
                      {field.required && <span className="text-red-500 ml-0.5">*</span>}
                    </label>
                  )}

                  {field.type === 'radio' ? (
                    <fieldset>
                      <legend className="block text-sm font-medium text-gray-700 mb-2">
                        {field.label}
                        {field.required && <span className="text-red-500 ml-0.5">*</span>}
                      </legend>
                      <div className="space-y-2">
                        {(field.options || []).map((opt) => (
                          <label key={opt.value} className={`flex items-center gap-3 cursor-pointer px-4 py-3 rounded-lg border transition ${
                            formData[field.name] === opt.value
                              ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5 ring-2 ring-[var(--color-primary)]/20'
                              : 'border-gray-300 hover:border-gray-400'
                          }`}>
                            <input
                              type="radio"
                              name={field.name}
                              value={opt.value}
                              checked={formData[field.name] === opt.value}
                              onChange={(e) => handleChange(field.name, e.target.value)}
                              className="w-5 h-5 text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                            />
                            <span className="text-sm text-gray-700 font-medium">{opt.label}</span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  ) : field.type === 'number' ? (
                    <input
                      type="number"
                      name={field.name}
                      value={formData[field.name] || ''}
                      onChange={(e) => handleChange(field.name, e.target.value)}
                      placeholder={field.placeholder || ''}
                      className={`w-full px-4 py-3 rounded-lg border ${
                        errors[field.name] ? 'border-red-400' : 'border-gray-300'
                      } focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 outline-none transition text-gray-800`}
                    />
                  ) : field.type === 'textarea' ? (
                    <textarea
                      name={field.name}
                      value={formData[field.name] || ''}
                      onChange={(e) => handleChange(field.name, e.target.value)}
                      placeholder={field.placeholder || ''}
                      rows={4}
                      className={`w-full px-4 py-3 rounded-lg border ${
                        errors[field.name] ? 'border-red-400' : 'border-gray-300'
                      } focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 outline-none transition text-gray-800`}
                    />
                  ) : field.type === 'select' ? (
                    <select
                      name={field.name}
                      value={formData[field.name] || ''}
                      onChange={(e) => handleChange(field.name, e.target.value)}
                      className={`w-full px-4 py-3 rounded-lg border ${
                        errors[field.name] ? 'border-red-400' : 'border-gray-300'
                      } focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 outline-none transition text-gray-800 bg-white`}
                    >
                      <option value="">{field.placeholder || 'Select...'}</option>
                      {(field.options || []).map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  ) : field.type === 'checkbox' ? (
                    <label className="flex items-start gap-3 cursor-pointer py-1">
                      <input
                        type="checkbox"
                        checked={formData[field.name] === 'true'}
                        onChange={(e) => handleChange(field.name, e.target.checked ? 'true' : '')}
                        className="mt-0.5 w-5 h-5 rounded border-gray-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                      />
                      <span className="text-sm text-gray-700">
                        {field.label}
                        {field.required && <span className="text-red-500 ml-0.5">*</span>}
                      </span>
                    </label>
                  ) : (
                    <input
                      type={field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : 'text'}
                      name={field.name}
                      value={formData[field.name] || ''}
                      onChange={(e) => handleChange(field.name, e.target.value)}
                      placeholder={field.placeholder || ''}
                      className={`w-full px-4 py-3 rounded-lg border ${
                        errors[field.name] ? 'border-red-400' : 'border-gray-300'
                      } focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 outline-none transition text-gray-800`}
                    />
                  )}

                  {errors[field.name] && (
                    <p className="text-red-500 text-xs mt-1">{errors[field.name]}</p>
                  )}
                </div>
              ))}
            </div>

            {/* Submit error */}
            {submitError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {submitError}
              </div>
            )}

            {/* Buttons */}
            <div className={`mt-6 flex ${isMultiStep && currentStep > 0 ? 'justify-between' : 'justify-center'}`}>
              {isMultiStep && currentStep > 0 && (
                <button
                  type="button"
                  onClick={handleBack}
                  className="px-6 py-3 rounded-lg border border-gray-300 text-gray-600 font-medium hover:bg-gray-50 transition"
                >
                  {backText}
                </button>
              )}

              {isLastStep ? (
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-textured cta-button px-8 py-3.5 rounded-[var(--button-radius)] font-bold text-base transition-all disabled:opacity-60 w-full max-w-sm"
                  style={isMultiStep && currentStep > 0 ? { maxWidth: 'none', flex: 1, marginLeft: 12 } : {}}
                >
                  {submitting ? 'Submitting...' : submitText}
                </button>
              ) : (
                <button
                  type="submit"
                  className="btn-textured cta-button px-8 py-3.5 rounded-[var(--button-radius)] font-bold text-base transition-all flex-1"
                  style={currentStep > 0 ? { marginLeft: 12 } : {}}
                >
                  {nextText}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </section>
  )
}
