'use client'

import { useState, useEffect, useCallback } from 'react'
import type { FormConfig, FormFieldDef } from './types'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''

interface Props {
  formConfig: FormConfig
  pageSlug?: string
  clientSlug?: string
  publishedPageId?: string
}

export default function LeadFormDynamic({ formConfig, pageSlug, clientSlug, publishedPageId }: Props) {
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
                            ? 'bg-[var(--color-accent)] text-white'
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
                  {field.type !== 'checkbox' && (
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      {field.label}
                      {field.required && <span className="text-red-500 ml-0.5">*</span>}
                    </label>
                  )}

                  {field.type === 'textarea' ? (
                    <textarea
                      name={field.name}
                      value={formData[field.name] || ''}
                      onChange={(e) => handleChange(field.name, e.target.value)}
                      placeholder={field.placeholder || ''}
                      rows={4}
                      className={`w-full px-4 py-3 rounded-lg border ${
                        errors[field.name] ? 'border-red-400' : 'border-gray-300'
                      } focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/20 outline-none transition text-gray-800`}
                    />
                  ) : field.type === 'select' ? (
                    <select
                      name={field.name}
                      value={formData[field.name] || ''}
                      onChange={(e) => handleChange(field.name, e.target.value)}
                      className={`w-full px-4 py-3 rounded-lg border ${
                        errors[field.name] ? 'border-red-400' : 'border-gray-300'
                      } focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/20 outline-none transition text-gray-800 bg-white`}
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
                        className="mt-0.5 w-5 h-5 rounded border-gray-300 text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
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
                      } focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/20 outline-none transition text-gray-800`}
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
                  className="btn-textured px-8 py-3.5 rounded-[var(--button-radius)] bg-[var(--color-accent)] text-white font-bold text-base transition-all disabled:opacity-60 w-full max-w-sm"
                  style={isMultiStep && currentStep > 0 ? { maxWidth: 'none', flex: 1, marginLeft: 12 } : {}}
                >
                  {submitting ? 'Submitting...' : submitText}
                </button>
              ) : (
                <button
                  type="submit"
                  className="btn-textured px-8 py-3.5 rounded-[var(--button-radius)] bg-[var(--color-accent)] text-white font-bold text-base transition-all flex-1"
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
