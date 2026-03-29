'use client'

import { useState } from 'react'
import type { Section, SectionItem, MediaAssets } from './types'
import AnimatedBackground from '../shared/AnimatedBackground'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Shield,
  Star,
  DollarSign,
  Award,
  Phone,
  CheckCircle,
  Zap,
  Target,
  Users,
  Eye,
  FileText,
  Calendar,
  ThumbsUp,
  Heart,
  CreditCard,
  MapPin,
  TrendingUp,
  Briefcase,
  Home,
} from 'lucide-react'

/* ─── Icon map ─── */
const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  clock: Clock, shield: Shield, star: Star, dollar: DollarSign,
  award: Award, phone: Phone, check: CheckCircle, zap: Zap,
  target: Target, users: Users, eye: Eye, file: FileText,
  calendar: Calendar, thumbs_up: ThumbsUp, heart: Heart,
  credit_card: CreditCard, map_pin: MapPin, trending_up: TrendingUp,
  briefcase: Briefcase, home: Home,
}
function Icon({ name, className }: { name?: string; className?: string }) {
  const C = name ? ICONS[name] : null
  return C ? <C className={className} /> : <CheckCircle className={className} />
}

/* ─── Accent word highlight ─── */
function AH({ text, word, className }: { text: string; word?: string; className?: string }) {
  if (!word || !text.includes(word)) return <span className={className}>{text}</span>
  const i = text.indexOf(word)
  return (
    <span className={className}>
      {text.slice(0, i)}
      <span className="text-[var(--color-accent)]">{word}</span>
      {text.slice(i + word.length)}
    </span>
  )
}

/* ─── Social icons ─── */
function FacebookIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
}
function LinkedinIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>
}
function InstagramIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
}
function XIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
}
const SOCIALS: Record<string, React.ComponentType<{ className?: string }>> = {
  facebook: FacebookIcon, linkedin: LinkedinIcon, instagram: InstagramIcon, twitter: XIcon, x: XIcon,
}

/* ═══════════════════════════════════════════════════════
   COLOR USAGE GUIDE:
   - --color-primary: Icons, icon backgrounds, borders, decorative elements, blobs, section backgrounds
   - --color-secondary: Dark sections (trust bar, footer), overlays
   - --color-accent: CTA buttons ONLY, accent word highlights, stat numbers
   - --color-text: Headings and body text
   - --color-bg: Page background
   ═══════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════
   MAIN TEMPLATE
   ═══════════════════════════════════════════════════════ */

interface Props {
  sections: Section[]
  media: MediaAssets
}

export default function LeadCaptureClassic({ sections, media }: Props) {
  const s = new Map<string, Section>()
  sections.forEach(sec => s.set(sec.type, sec))

  const hero = s.get('hero')
  const features = s.get('feature_cards')
  const info = s.get('two_column_info')
  const steps = s.get('steps')
  const trust = s.get('trust_bar')
  const benefits = s.get('benefits_grid')
  const testimonials = s.get('testimonials')
  const faq = s.get('faq')
  const footer = s.get('footer')

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: 'var(--font-body)' }}>
      {/* ─── HEADER ─── */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 md:px-10 lg:px-12 xl:px-24 flex items-center justify-between py-3">
          {media.logo ? (
            <img src={media.logo} alt="Logo" className="h-8 md:h-10 object-contain" />
          ) : (
            <div className="h-8 w-28 rounded bg-gray-200/50" />
          )}
          <a
            href="#lead-form"
            className="btn-textured py-2.5 px-5 md:px-6 rounded-[var(--button-radius)] bg-[var(--color-accent)] text-white font-semibold text-sm transition-all"
          >
            {hero?.cta || 'Get Started'}
          </a>
        </div>
      </header>

      {/* ─── HERO ─── */}
      {hero && <HeroBlock section={hero} media={media} />}

      {/* ─── FEATURE CARDS BAR ─── */}
      {features && <FeatureCardsBar section={features} />}

      {/* ─── TWO COLUMN INFO ─── */}
      {info && <TwoColumnInfo section={info} />}

      {/* ─── STEPS ─── */}
      {steps && <StepsBlock section={steps} media={media} />}

      {/* ─── TRUST BAR ─── */}
      {trust && <TrustBar section={trust} media={media} />}

      {/* ─── BENEFITS GRID ─── */}
      {benefits && <BenefitsGrid section={benefits} media={media} />}

      {/* ─── TESTIMONIALS ─── */}
      {testimonials && <TestimonialsBlock section={testimonials} media={media} />}

      {/* ─── FAQ ─── */}
      {faq && <FaqBlock section={faq} />}

      {/* ─── FOOTER ─── */}
      <FooterBlock section={footer} media={media} />
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   HERO — White bg, text left, person image right with blob
   ═══════════════════════════════════════════════════════ */
function HeroBlock({ section, media }: { section: Section; media: MediaAssets }) {
  const img = media.hero_image
  return (
    <section className="relative overflow-hidden bg-white">
      <AnimatedBackground />
      <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-10 lg:px-12 xl:px-24 py-16 md:py-20">
        <div className="flex flex-col md:flex-row items-center gap-10 md:gap-6">
          {/* Left: text */}
          <div className="flex-1 text-center md:text-left md:max-w-[55%]">
            <h1
              className="text-4xl sm:text-5xl lg:text-[3.5rem] font-bold text-[var(--color-text)] leading-[1.1] mb-5"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              <AH text={section.headline || ''} word={section.accent_word} />
            </h1>
            {(section.subheadline || section.content) && (
              <p className="text-base md:text-lg text-gray-500 leading-relaxed mb-8 max-w-lg mx-auto md:mx-0">
                {section.subheadline || section.content}
              </p>
            )}
            <a
              href={section.cta_url || '#lead-form'}
              className="btn-textured inline-block py-3.5 px-8 rounded-full bg-[var(--color-accent)] text-white font-bold text-base transition-all"
            >
              {section.cta}
            </a>
            {section.sub_cta && (
              <div className="mt-4 flex items-center justify-center md:justify-start gap-2">
                <span className="inline-flex items-center gap-2 bg-gray-100 rounded-full px-4 py-1.5 text-gray-500 text-sm border border-gray-200">
                  <Clock className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                  {section.sub_cta}
                </span>
              </div>
            )}
          </div>

          {/* Right: person image with blob */}
          <div className="flex-shrink-0 md:max-w-[45%] flex justify-center">
            {img ? (
              <div className="relative w-[320px] md:w-[400px] lg:w-[460px] aspect-square">
                {/* Organic blob bg — uses primary color */}
                <div
                  className="absolute inset-0 bg-gradient-to-br from-[var(--color-primary)]/20 to-[var(--color-primary)]/8"
                  style={{ borderRadius: '30% 70% 70% 30% / 30% 30% 70% 70%' }}
                />
                <div
                  className="absolute inset-[3%] bg-gradient-to-br from-[var(--color-primary)]/15 to-[var(--color-primary)]/5"
                  style={{ borderRadius: '40% 60% 55% 45% / 40% 45% 55% 60%' }}
                />
                <img
                  src={img}
                  alt=""
                  className="absolute inset-0 w-full h-full object-contain drop-shadow-2xl z-10"
                  style={{ background: 'transparent' }}
                />
              </div>
            ) : (
              <div
                className="w-[320px] h-[320px] bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/10"
                style={{ borderRadius: '30% 70% 70% 30% / 30% 30% 70% 70%' }}
              />
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════
   FEATURE CARDS — Primary color bar with 3 white cards
   ═══════════════════════════════════════════════════════ */
function FeatureCardsBar({ section }: { section: Section }) {
  const items = section.items || []
  return (
    <section className="bg-[var(--color-primary)] py-5 md:py-6">
      <div className="max-w-7xl mx-auto px-4 md:px-10 lg:px-12 xl:px-24">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
          {items.map((item, i) => (
            <div key={i} className="bg-white rounded-2xl shadow-sm p-4 md:p-5 flex items-center gap-4">
              <div className="relative flex-shrink-0">
                <div className="w-12 h-12 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center">
                  <Icon name={item.icon} className="w-5 h-5 text-[var(--color-primary)]" />
                </div>
                <div className="absolute -top-1 -right-1 w-12 h-12 rounded-full bg-[var(--color-primary)]/5 -z-10" />
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">{item.label}</p>
                <p className="text-base font-bold text-[var(--color-text)]">{item.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════
   TWO COLUMN INFO — Headline, two bordered boxes, CTA
   ═══════════════════════════════════════════════════════ */
function TwoColumnInfo({ section }: { section: Section }) {
  const items = section.items || []
  const half = Math.ceil(items.length / 2)
  const left = items.slice(0, half)
  const right = items.slice(half)

  return (
    <section className="py-16 md:py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 md:px-10 lg:px-12 xl:px-24">
        <div className="text-center max-w-3xl mx-auto mb-10">
          <h2
            className="text-3xl md:text-4xl font-bold text-[var(--color-text)] mb-4"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            <AH text={section.headline || ''} word={section.accent_word} />
          </h2>
          {section.subheadline && (
            <p className="text-base text-gray-500 leading-relaxed">{section.subheadline}</p>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-5 md:gap-6 mb-10">
          <InfoBox items={left} title={left[0]?.title} />
          <InfoBox items={right} title={right[0]?.title} />
        </div>

        {section.cta && (
          <div className="text-center">
            <a
              href={section.cta_url || '#lead-form'}
              className="btn-textured inline-block py-3.5 px-8 rounded-full bg-[var(--color-accent)] text-white font-bold text-base transition-all"
            >
              {section.cta}
            </a>
          </div>
        )}
      </div>
    </section>
  )
}

function InfoBox({ items, title }: { items: SectionItem[]; title?: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-primary)]/25 p-6 md:p-7">
      {title && (
        <h3 className="font-bold text-lg text-[var(--color-text)] mb-4">{title}</h3>
      )}
      <ul className="space-y-3">
        {items.map((item, i) => {
          if (i === 0 && item.title) return null
          return (
            <li key={i} className="flex items-start gap-2.5">
              <CheckCircle className="w-4.5 h-4.5 mt-0.5 text-[var(--color-primary)] flex-shrink-0" />
              <span className="text-sm text-gray-600 leading-relaxed">{item.text}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   STEPS — Image left, numbered step cards right
   ═══════════════════════════════════════════════════════ */
function StepsBlock({ section, media }: { section: Section; media: MediaAssets }) {
  const items = section.items || []
  const img = media.steps_image

  return (
    <section className="py-16 md:py-20 bg-gray-50/50">
      <div className="max-w-7xl mx-auto px-4 md:px-10 lg:px-12 xl:px-24">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h2
            className="text-3xl md:text-4xl font-bold text-[var(--color-text)] mb-3"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            <AH text={section.headline || ''} word={section.accent_word} />
          </h2>
          {section.subheadline && (
            <p className="text-base text-gray-500">{section.subheadline}</p>
          )}
        </div>

        <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-14">
          {/* Left: image with blob */}
          <div className="lg:w-4/12 flex justify-center">
            {img ? (
              <div className="relative w-[280px]">
                <div
                  className="absolute inset-[-8%] bg-[var(--color-primary)]/8"
                  style={{ borderRadius: '30% 70% 70% 30% / 30% 30% 70% 70%' }}
                />
                <img src={img} alt="" className="relative z-10 rounded-3xl shadow-xl w-full" />
              </div>
            ) : (
              <div className="w-[250px] h-[400px] rounded-3xl bg-gray-100 border border-gray-200" />
            )}
          </div>

          {/* Right: step cards */}
          <div className="lg:w-8/12 space-y-4">
            {items.map((item, i) => (
              <div
                key={i}
                className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 md:p-6 flex items-start gap-4"
              >
                <div className="relative flex-shrink-0">
                  <div className="w-14 h-14 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center">
                    <Icon name={item.icon} className="w-6 h-6 text-[var(--color-primary)]" />
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-[var(--color-text)] mb-1">{item.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{item.text}</p>
                  {i === items.length - 1 && section.cta && (
                    <a
                      href={section.cta_url || '#lead-form'}
                      className="btn-textured inline-block mt-3 py-2.5 px-6 rounded-full bg-[var(--color-accent)] text-white font-semibold text-sm transition-all"
                    >
                      {section.cta}
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════
   TRUST BAR — Dark bg, 3 stat/trust cards
   ═══════════════════════════════════════════════════════ */
function TrustBar({ section, media }: { section: Section; media: MediaAssets }) {
  const items = section.items || []
  const parallax = media.parallax_image
  return (
    <section
      className="relative py-14 md:py-20 overflow-hidden"
      style={parallax ? {
        backgroundImage: `url(${parallax})`,
        backgroundAttachment: 'fixed',
        backgroundPosition: 'center',
        backgroundSize: 'cover',
      } : undefined}
    >
      {/* Dark overlay — uses secondary color */}
      <div className={`absolute inset-0 ${parallax ? 'bg-[var(--color-secondary)]/85' : 'bg-gradient-to-br from-[var(--color-secondary)] to-[var(--color-secondary)]/90'}`} />

      {parallax && (
        <style>{`
          @supports (-webkit-touch-callout: none) {
            [style*="background-attachment: fixed"] { background-attachment: scroll !important; }
          }
        `}</style>
      )}

      <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-10 lg:px-12 xl:px-24">
        {section.headline && (
          <h2
            className="text-2xl md:text-3xl font-bold text-white text-center mb-10 italic"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            <AH text={section.headline} word={section.accent_word} />
          </h2>
        )}
        <div className="grid sm:grid-cols-3 gap-5 md:gap-8">
          {items.map((item, i) => (
            <div
              key={i}
              className="rounded-xl border border-white/15 p-6 md:p-7 text-center"
            >
              {item.image ? (
                <img src={item.image} alt="" className="h-12 mx-auto mb-3 object-contain" />
              ) : item.stat ? (
                <p className="text-3xl md:text-4xl font-bold text-[var(--color-accent)] mb-2">{item.stat}</p>
              ) : null}
              <div className="w-12 h-px bg-white/20 mx-auto mb-3" />
              <p className="text-sm text-white/70">{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════
   BENEFITS GRID — Content left (2x2 cards), image right
   ═══════════════════════════════════════════════════════ */
function BenefitsGrid({ section, media }: { section: Section; media: MediaAssets }) {
  const items = section.items || []
  const img = media.benefits_image

  return (
    <section className="py-16 md:py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 md:px-10 lg:px-12 xl:px-24">
        <div className="text-center max-w-3xl mx-auto mb-10">
          <h2
            className="text-3xl md:text-4xl font-bold text-[var(--color-text)] mb-3"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            <AH text={section.headline || ''} word={section.accent_word} />
          </h2>
          {section.content && (
            <p className="text-base text-gray-500">{section.content}</p>
          )}
        </div>

        <div className="flex flex-col lg:flex-row gap-10 lg:gap-12 items-center">
          {/* Left: 2x2 card grid */}
          <div className="lg:w-8/12">
            <div className="grid sm:grid-cols-2 gap-4">
              {items.map((item, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-[var(--color-primary)]/20 p-5 text-center hover:border-[var(--color-primary)]/40 hover:shadow-md transition-all"
                >
                  <h3 className="font-bold text-[var(--color-text)] mb-2">{item.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{item.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right: image + CTA */}
          <div className="lg:w-4/12 flex flex-col items-center gap-6">
            {img ? (
              <div className="relative w-full max-w-[280px]">
                <div
                  className="absolute inset-[-6%] bg-[var(--color-primary)]/8"
                  style={{ borderRadius: '30% 70% 70% 30% / 30% 30% 70% 70%' }}
                />
                <img src={img} alt="" className="relative z-10 rounded-2xl shadow-lg w-full" />
              </div>
            ) : (
              <div className="w-[250px] h-[250px] rounded-2xl bg-gray-100" />
            )}
            {section.cta && (
              <a
                href={section.cta_url || '#lead-form'}
                className="btn-textured inline-block py-3.5 px-8 rounded-full bg-[var(--color-accent)] text-white font-bold text-base transition-all"
              >
                {section.cta}
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════
   TESTIMONIALS — Cards with stars, quotes, avatars
   ═══════════════════════════════════════════════════════ */
function TestimonialsBlock({ section, media }: { section: Section; media: MediaAssets }) {
  const items = section.items || []
  const [active, setActive] = useState(0)
  const perPage = 3

  return (
    <section className="py-16 md:py-20 bg-gray-50/50">
      <div className="max-w-7xl mx-auto px-4 md:px-10 lg:px-12 xl:px-24">
        <h2
          className="text-3xl md:text-4xl font-bold text-[var(--color-text)] text-center mb-10"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          <AH text={section.headline || ''} word={section.accent_word} />
        </h2>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((item, i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 flex flex-col"
            >
              {/* Stars */}
              <div className="flex gap-0.5 mb-3">
                {[...Array(5)].map((_, si) => (
                  <Star
                    key={si}
                    className={`w-4.5 h-4.5 ${
                      si < (item.rating || 5)
                        ? 'text-yellow-400 fill-yellow-400'
                        : 'text-gray-200'
                    }`}
                  />
                ))}
              </div>
              {/* Quote */}
              <p className="text-sm text-gray-600 leading-relaxed flex-1 mb-4 italic">
                &ldquo;{item.quote}&rdquo;
              </p>
              {/* Author */}
              <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                {(item.photo || media.testimonial_photos?.[i]) && (
                  <img
                    src={item.photo || media.testimonial_photos?.[i]}
                    alt={item.name || ''}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                )}
                <div>
                  <p className="font-semibold text-sm text-[var(--color-text)]">{item.name}</p>
                  {item.role && <p className="text-xs text-gray-400">{item.role}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Dots */}
        {items.length > perPage && (
          <div className="flex justify-center gap-2 mt-6">
            {[...Array(Math.ceil(items.length / perPage))].map((_, i) => (
              <button
                key={i}
                onClick={() => setActive(i)}
                className={`w-2.5 h-2.5 rounded-full transition-colors ${
                  i === active ? 'bg-[var(--color-primary)]' : 'bg-gray-300'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════
   FAQ — Accordion
   ═══════════════════════════════════════════════════════ */
function FaqBlock({ section }: { section: Section }) {
  const [open, setOpen] = useState<number | null>(null)
  const items = section.items || []

  return (
    <section className="py-16 md:py-20 bg-white">
      <div className="max-w-3xl mx-auto px-4 md:px-10">
        <h2
          className="text-3xl md:text-4xl font-bold text-[var(--color-text)] text-center mb-10"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          <AH text={section.headline || ''} word={section.accent_word} />
        </h2>

        <div className="space-y-0 divide-y divide-gray-200">
          {items.map((item, i) => (
            <div key={i}>
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between py-5 text-left group"
              >
                <span className="font-medium text-[var(--color-text)] group-hover:text-[var(--color-primary)] transition-colors pr-4">
                  {item.question}
                </span>
                <ChevronDown
                  className={`w-5 h-5 text-gray-400 transition-transform duration-200 flex-shrink-0 ${
                    open === i ? 'rotate-180' : ''
                  }`}
                />
              </button>
              <div
                className="overflow-hidden transition-all duration-300"
                style={{ maxHeight: open === i ? '300px' : '0px' }}
              >
                <p className="pb-5 text-sm text-gray-500 leading-relaxed">
                  {item.answer}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════
   FOOTER — Dark bg, logo, links, phone, social
   ═══════════════════════════════════════════════════════ */
function FooterBlock({ section, media }: { section?: Section; media: MediaAssets }) {
  return (
    <footer className="bg-[var(--color-secondary)] py-8 md:py-10">
      <div className="max-w-7xl mx-auto px-4 md:px-10 lg:px-12 xl:px-24">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Logo */}
          <div>
            {media.logo ? (
              <img src={media.logo} alt="Logo" className="h-6 md:h-8 object-contain brightness-200 invert" />
            ) : (
              <div className="h-6 w-24 rounded bg-white/10" />
            )}
          </div>

          {/* Links */}
          <div className="flex items-center gap-6 text-sm">
            {section?.links?.map((link, i) => (
              <a key={i} href={link.url} className="text-white/50 hover:text-white/80 transition-colors">
                {link.label}
              </a>
            ))}
            {section?.phone && (
              <a href={`tel:${section.phone}`} className="text-white/50 hover:text-white/80 transition-colors flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5" />
                {section.phone}
              </a>
            )}
          </div>

          {/* Social icons */}
          <div className="flex items-center gap-3">
            {section?.socials?.map((social, i) => {
              const SIcon = SOCIALS[social.platform]
              return SIcon ? (
                <a
                  key={i}
                  href={social.url}
                  className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
                >
                  <SIcon className="w-3.5 h-3.5 text-white/70" />
                </a>
              ) : null
            })}
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-white/10 text-center">
          <p className="text-xs text-white/30">
            &copy; {new Date().getFullYear()} All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
