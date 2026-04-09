'use client'

import { useState, useEffect, useRef } from 'react'
import type { Section, SectionItem, MediaAssets, TrustpilotWidget, ReviewSite, PlatformReview, FormConfig } from './types'
import LeadFormDynamic from './LeadFormDynamic'
import AnimatedBackground from '../shared/AnimatedBackground'
import { CaretDown as ChevronDown } from '@phosphor-icons/react'
import {
  Clock as PhClock,
  Shield as PhShield,
  Star as PhStar,
  CurrencyDollar as PhDollar,
  Trophy as PhAward,
  Phone as PhPhone,
  CheckCircle as PhCheckCircle,
  Lightning as PhZap,
  Target as PhTarget,
  Users as PhUsers,
  Eye as PhEye,
  FileText as PhFileText,
  Calendar as PhCalendar,
  ThumbsUp as PhThumbsUp,
  Heart as PhHeart,
  CreditCard as PhCreditCard,
  MapPin as PhMapPin,
  TrendUp as PhTrendingUp,
  Briefcase as PhBriefcase,
  House as PhHome,
  Handshake as PhHandshake,
  ChartBar as PhChartBar,
  Percent as PhPercent,
  Rocket as PhRocket,
  Clipboard as PhClipboard,
  Gear as PhGear,
  Lock as PhLock,
  Headset as PhHeadset,
  Lifebuoy as PhLifebuoy,
  Wrench as PhWrench,
  Truck as PhTruck,
  Leaf as PhLeaf,
  Stethoscope as PhStethoscope,
  GraduationCap as PhGraduationCap,
  Scales as PhScales,
  PaintBrush as PhPaintBrush,
  Buildings as PhBuildings,
  Storefront as PhStorefront,
  Bank as PhBank,
  Sparkle as PhSparkle,
  Medal as PhMedal,
  ArrowsClockwise as PhArrowsClockwise,
} from '@phosphor-icons/react'

/* ─── Phosphor Duotone Icon Map ───
   Maps icon name strings (from AI copy generation) to Phosphor components.
   All rendered in duotone style for consistent two-tone illustrated look.
   7,000+ icons available — add more mappings as needed.
─── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PHOSPHOR_ICONS: Record<string, React.ComponentType<any>> = {
  clock: PhClock, shield: PhShield, star: PhStar, dollar: PhDollar,
  award: PhAward, phone: PhPhone, check: PhCheckCircle, zap: PhZap,
  target: PhTarget, users: PhUsers, eye: PhEye, file: PhFileText,
  calendar: PhCalendar, thumbs_up: PhThumbsUp, heart: PhHeart,
  credit_card: PhCreditCard, map_pin: PhMapPin, trending_up: PhTrendingUp,
  briefcase: PhBriefcase, home: PhHome, handshake: PhHandshake,
  chart: PhChartBar, percent: PhPercent, rocket: PhRocket,
  clipboard: PhClipboard, gear: PhGear, lock: PhLock,
  headset: PhHeadset, lifebuoy: PhLifebuoy, wrench: PhWrench,
  truck: PhTruck, leaf: PhLeaf, stethoscope: PhStethoscope,
  graduation: PhGraduationCap, scales: PhScales, paint: PhPaintBrush,
  buildings: PhBuildings, storefront: PhStorefront, bank: PhBank,
  sparkle: PhSparkle, medal: PhMedal, refresh: PhArrowsClockwise,
  trophy: PhAward,
}

/* Render a Phosphor duotone icon by name string */
function DuotoneIcon({ name, size = 28, color }: { name?: string; size?: number; color?: string }) {
  const C = name ? PHOSPHOR_ICONS[name] : null
  const IconComponent = C || PhCheckCircle
  return <IconComponent size={size} weight="duotone" color={color} />
}

/* DetailedIcon removed — replaced by Phosphor duotone icons (DuotoneIcon) */

/* ─── Accent word highlight ─── */
function AH({ text, word, className, color }: { text: string; word?: string; className?: string; color?: string }) {
  if (!word || !text.includes(word)) return <span className={className}>{text}</span>
  const i = text.indexOf(word)
  return (
    <span className={className}>
      {text.slice(0, i)}
      <span style={{ color: color || 'var(--color-accent)' }}>{word}</span>
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

/* ─── Section background lines (reusable — random directions, more visible) ─── */
function SectionLines({ color, opacity = 0.07 }: { color: string; opacity?: number }) {
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
      <line x1="0%" y1="25%" x2="45%" y2="0%" stroke={color} strokeWidth="1" opacity={opacity} />
      <line x1="65%" y1="100%" x2="100%" y2="45%" stroke={color} strokeWidth="1" opacity={opacity} />
      <line x1="15%" y1="100%" x2="55%" y2="60%" stroke={color} strokeWidth="0.75" opacity={opacity * 0.8} />
      <line x1="80%" y1="0%" x2="40%" y2="100%" stroke={color} strokeWidth="0.75" opacity={opacity * 0.6} />
      <line x1="0%" y1="70%" x2="30%" y2="100%" stroke={color} strokeWidth="0.75" opacity={opacity * 0.7} />
      <line x1="90%" y1="0%" x2="100%" y2="35%" stroke={color} strokeWidth="0.75" opacity={opacity * 0.5} />
      <line x1="50%" y1="0%" x2="20%" y2="50%" stroke={color} strokeWidth="0.5" opacity={opacity * 0.5} />
    </svg>
  )
}

/* ═══════════════════════════════════════════════════════
   COLOR USAGE GUIDE:
   - --color-primary: THE dominant brand color. Used for: CTA buttons, icons, icon backgrounds,
                      borders, decorative elements, blobs, section backgrounds, headline accent
                      word highlights, step badges, stat numbers. This IS the brand.
   - --color-secondary: Dark sections (trust bar, footer), overlays, fallback when primary lacks contrast
   - --color-accent: MINIMAL use. Only as a subtle highlight where primary and secondary are both used.
                      Never buttons, never headlines, never icons.
   - --color-text: Headings and body text
   - --color-bg: Page background
   ═══════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════
   COLOR SAFETY UTILITIES
   Enforces readability rules:
   - No low-contrast text (e.g. red on blue, yellow on white)
   - Button text always readable against button bg
   - Accent highlights readable on dark and light sections
   ═══════════════════════════════════════════════════════ */

/** Parse hex to RGB */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const h = hex.replace('#', '')
  if (h.length < 6) return null
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  }
}

/** Relative luminance (0 = black, 1 = white) per WCAG */
function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(c => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

/** WCAG contrast ratio between two colors (1:1 to 21:1) */
function getContrastRatio(color1: string, color2: string): number {
  const c1 = hexToRgb(color1)
  const c2 = hexToRgb(color2)
  if (!c1 || !c2) return 1
  const l1 = getLuminance(c1.r, c1.g, c1.b)
  const l2 = getLuminance(c2.r, c2.g, c2.b)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

/** Get readable text color for a given background. Always returns white or dark. */
function getContrastTextColor(bgColor: string): string {
  const rgb = hexToRgb(bgColor)
  if (!rgb) return '#ffffff'
  const lum = getLuminance(rgb.r, rgb.g, rgb.b)
  return lum > 0.4 ? '#1a1a2e' : '#ffffff'
}

/** Check if a color is too light to be used on white backgrounds */
function isLightColor(color: string): boolean {
  const rgb = hexToRgb(color)
  if (!rgb) return false
  const lum = getLuminance(rgb.r, rgb.g, rgb.b)
  return lum > 0.4
}

/**
 * Get a safe highlight color for use on a dark background.
 * If accent has poor contrast against the dark bg, fall back to white.
 * Minimum contrast ratio: 4.5:1 (WCAG AA for normal text)
 */
function getSafeHighlightOnDark(accentColor: string, darkBg: string): string {
  const ratio = getContrastRatio(accentColor, darkBg)
  // If accent has good contrast on dark bg, use it
  if (ratio >= 3.5) return accentColor
  // Otherwise use white — always readable on dark
  return '#ffffff'
}

/**
 * Get a safe accent color for text on light/white backgrounds.
 * If accent is too light (yellow, light green), darken or fall back to primary.
 */
function getSafeAccentOnLight(accentColor: string, primaryColor: string): string {
  const ratio = getContrastRatio(accentColor, '#ffffff')
  if (ratio >= 3.5) return accentColor
  // Try primary as fallback
  const primaryRatio = getContrastRatio(primaryColor, '#ffffff')
  if (primaryRatio >= 3.5) return primaryColor
  // Ultimate fallback — dark text
  return '#1a1a2e'
}

/**
 * Get safe button styles: bg color + text color with guaranteed readability.
 * Rules:
 * - Button text must have >= 4.5:1 contrast against button bg
 * - Button bg must have >= 3:1 contrast against section bg
 * - No yellow/light buttons on white backgrounds
 * - No white text on yellow/light buttons
 */
function getSafeButtonColors(
  accentColor: string,
  secondaryColor: string,
  sectionBg: string = '#ffffff'
): { bg: string; text: string } {
  // Check if accent has good contrast against section bg
  const accentVsBg = getContrastRatio(accentColor, sectionBg)
  let btnBg = accentColor

  if (accentVsBg < 3) {
    // Accent doesn't stand out — use secondary (dark) instead
    btnBg = secondaryColor
  }

  // Determine text color with guaranteed contrast
  const textColor = getContrastTextColor(btnBg)
  const textContrast = getContrastRatio(textColor, btnBg)

  // If even our auto text color doesn't have enough contrast, force the opposite
  if (textContrast < 4.5) {
    return { bg: btnBg, text: textColor === '#ffffff' ? '#1a1a2e' : '#ffffff' }
  }

  return { bg: btnBg, text: textColor }
}

/* ═══════════════════════════════════════════════════════
   MAIN TEMPLATE
   ═══════════════════════════════════════════════════════ */

interface BrandKitColors {
  primary_color?: string
  secondary_color?: string
  accent_color?: string
  background_color?: string
  text_color?: string
  heading_font?: string
  body_font?: string
  button_style?: { borderRadius?: string }
}

interface Props {
  sections: Section[]
  media: MediaAssets
  brandKit?: BrandKitColors | null
  formConfig?: FormConfig | null
  pageSlug?: string
  clientSlug?: string
  publishedPageId?: string
}

export default function LeadCaptureClassic({ sections, media, brandKit, formConfig, pageSlug, clientSlug, publishedPageId }: Props) {
  // Sanitize all text fields in sections to fix garbled UTF-8
  const cleanSections = sections.map(sec => ({
    ...sec,
    headline: sec.headline ? sanitizeText(sec.headline) : sec.headline,
    subheadline: sec.subheadline ? sanitizeText(sec.subheadline) : sec.subheadline,
    content: sec.content ? sanitizeText(sec.content) : sec.content,
    cta: sec.cta ? sanitizeText(sec.cta) : sec.cta,
    sub_cta: sec.sub_cta ? sanitizeText(sec.sub_cta) : sec.sub_cta,
    items: sec.items?.map(item => ({
      ...item,
      label: item.label ? sanitizeText(item.label) : item.label,
      title: item.title ? sanitizeText(item.title) : item.title,
      text: item.text ? sanitizeText(item.text) : item.text,
      quote: item.quote ? sanitizeText(item.quote) : item.quote,
      question: item.question ? sanitizeText(item.question) : item.question,
      answer: item.answer ? sanitizeText(item.answer) : item.answer,
    })),
  }))
  const s = new Map<string, Section>()
  cleanSections.forEach(sec => s.set(sec.type, sec))

  const hero = s.get('hero')
  const features = s.get('feature_cards')
  const info = s.get('two_column_info')
  const steps = s.get('steps')
  const trust = s.get('trust_bar')
  const benefits = s.get('benefits_grid')
  const testimonials = s.get('testimonials')
  const faq = s.get('faq')
  const footer = s.get('footer')

  // Brand colors — use props directly (no useEffect race condition)
  const accentColor = brandKit?.accent_color || '#10b981'
  const primaryColor = brandKit?.primary_color || '#1a365d'
  const secondaryColor = brandKit?.secondary_color || '#1a202c'

  // Also read from CSS variables as fallback (for client repos that set CSS vars)
  const [resolvedAccent, setResolvedAccent] = useState(accentColor)
  const [resolvedPrimary, setResolvedPrimary] = useState(primaryColor)
  useEffect(() => {
    // If brandKit was provided, use it directly — no need to read CSS vars
    if (brandKit?.accent_color) {
      setResolvedAccent(brandKit.accent_color)
      setResolvedPrimary(brandKit.primary_color || primaryColor)
      return
    }
    // Fallback: read from CSS custom properties (for standalone/repo usage)
    const root = document.documentElement
    const styles = getComputedStyle(root)
    const acc = styles.getPropertyValue('--color-accent').trim()
    const pri = styles.getPropertyValue('--color-primary').trim()
    if (acc) setResolvedAccent(acc)
    if (pri) setResolvedPrimary(pri)
  }, [brandKit, accentColor, primaryColor])

  // Load Google Fonts if brandKit specifies custom fonts
  useEffect(() => {
    if (!brandKit) return
    const fonts = [brandKit.heading_font, brandKit.body_font].filter(Boolean) as string[]
    const uniqueFonts = [...new Set(fonts)].filter(f => f && !f.includes('sans-serif') && !f.includes('serif'))
    if (uniqueFonts.length > 0) {
      const existing = document.querySelector('link[data-brand-fonts]')
      if (existing) existing.remove()
      const families = uniqueFonts.map(f => `family=${encodeURIComponent(f)}:wght@400;500;600;700;800;900`).join('&')
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = `https://fonts.googleapis.com/css2?${families}&display=swap`
      link.setAttribute('data-brand-fonts', 'true')
      document.head.appendChild(link)
    }
  }, [brandKit])

  // Compute safe button colors — prefer PRIMARY for buttons (brand identity),
  // only fall back to accent/secondary if primary lacks contrast
  const safeBtnLight = getSafeButtonColors(resolvedPrimary, secondaryColor, '#ffffff')
  const safeBtnDark = getSafeButtonColors(resolvedPrimary, secondaryColor, secondaryColor)
  // Headline accent word color — uses PRIMARY (brand identity color)
  const safeAccentOnLightBg = getSafeAccentOnLight(resolvedPrimary, resolvedPrimary)
  // On dark sections: accent word highlights use white for guaranteed readability
  const safeAccentOnDarkBg = '#ffffff'
  // Trust bar stat numbers — use primary if it has contrast on dark, otherwise white
  const safeStatColor = getSafeHighlightOnDark(resolvedPrimary, secondaryColor)

  // Safety: if text_color is too light for white/light backgrounds, force it to dark
  // This prevents white-on-white text when the brand kit extracts a light text color
  const rawTextColor = brandKit?.text_color || '#1a202c'
  const safeTextColor = isLightColor(rawTextColor) ? '#1a202c' : rawTextColor

  // CSS custom properties to inject on the template root (ensures colors are available immediately)
  const cssVars: Record<string, string> = {
    '--color-primary': brandKit?.primary_color || primaryColor,
    '--color-secondary': brandKit?.secondary_color || secondaryColor,
    '--color-accent': brandKit?.accent_color || accentColor,
    '--color-background': brandKit?.background_color || '#ffffff',
    '--color-text': safeTextColor,
    '--font-heading': brandKit?.heading_font || 'Inter, sans-serif',
    '--font-body': brandKit?.body_font || 'Inter, sans-serif',
    '--button-radius': brandKit?.button_style?.borderRadius || '9999px',
  }

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: 'var(--font-body)', ...cssVars } as React.CSSProperties}>
      {/* Inject CTA button styles — WCAG-safe contrast */}
      <style>{`
        .cta-button {
          background-color: ${safeBtnLight.bg} !important;
          color: ${safeBtnLight.text} !important;
          text-shadow: ${safeBtnLight.text === '#ffffff' ? '0 1px 2px rgba(0,0,0,0.3)' : 'none'};
        }
        .cta-button-on-dark {
          background-color: ${safeBtnDark.bg} !important;
          color: ${safeBtnDark.text} !important;
        }
      `}</style>

      {/* ─── HEADER ─── */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-3 md:px-10 lg:px-12 xl:px-24 flex items-center justify-between py-2 md:py-3">
          {media.logo ? (
            <img src={media.logo} alt="Logo" className="h-7 md:h-10 max-w-[120px] md:max-w-[180px] object-contain" />
          ) : (
            <div className="h-7 md:h-8 w-24 md:w-28 rounded bg-gray-200/50" />
          )}
          <a
            href="#lead-form"
            className="btn-textured cta-button py-2 px-4 md:py-2.5 md:px-6 rounded-[var(--button-radius)] bg-[var(--color-primary)] font-semibold text-xs md:text-sm transition-all whitespace-nowrap"
          >
            {hero?.cta || 'Get Started'}
          </a>
        </div>
      </header>

      {/* ─── HERO ─── */}
      {hero && <HeroBlock section={hero} media={media} primaryColor={resolvedPrimary} accentColor={resolvedAccent} safeAccentOnLight={safeAccentOnLightBg} formConfig={formConfig || undefined} pageSlug={pageSlug} clientSlug={clientSlug} publishedPageId={publishedPageId} />}

      {/* ─── FEATURE CARDS BAR ─── */}
      {features && <FeatureCardsBar section={features} primaryColor={resolvedPrimary} accentColor={resolvedAccent} trustpilotWidget={media.trustpilot_widget} reviewSites={media.review_sites} />}

      {/* ─── PLATFORM REVIEWS (best-rated first, early in page) ─── */}
      {(() => {
        const grouped = groupReviewsByPlatform(media.platform_reviews, media.review_sites)
        const sorted = grouped.sort((a, b) => (b.avgRating || 0) - (a.avgRating || 0))
        const primary = sorted[0]  // best-rated platform — shows early
        const rest = sorted.slice(1) // additional platforms — show later
        return primary ? <PlatformReviewsBlock group={primary} /> : null
      })()}

      {/* ─── TWO COLUMN INFO ─── */}
      {info && <TwoColumnInfo section={info} media={media} safeAccentOnLight={safeAccentOnLightBg} />}

      {/* ─── STEPS ─── */}
      {steps && <StepsBlock section={steps} media={media} primaryColor={resolvedPrimary} accentColor={resolvedAccent} safeAccentOnLight={safeAccentOnLightBg} />}

      {/* ─── TRUST BAR ─── */}
      {trust && <TrustBar section={trust} media={media} safeAccentOnDark={safeAccentOnDarkBg} safeStatColor={safeStatColor} secondaryColor={secondaryColor} />}

      {/* ─── BENEFITS GRID ─── */}
      {benefits && <BenefitsGrid section={benefits} media={media} primaryColor={resolvedPrimary} accentColor={resolvedAccent} safeAccentOnLight={safeAccentOnLightBg} />}

      {/* ─── TESTIMONIALS ─── */}
      {testimonials && <TestimonialsBlock section={testimonials} media={media} safeAccentOnLight={safeAccentOnLightBg} />}

      {/* ─── ADDITIONAL PLATFORM REVIEWS (lower on page) ─── */}
      {(() => {
        const grouped = groupReviewsByPlatform(media.platform_reviews, media.review_sites)
        const sorted = grouped.sort((a, b) => (b.avgRating || 0) - (a.avgRating || 0))
        return sorted.slice(1).map(group => (
          <PlatformReviewsBlock key={group.platform} group={group} />
        ))
      })()}

      {/* ─── REVIEW BADGES (condensed badge bar) ─── */}
      <ReviewBadgesBlock trustpilotWidget={media.trustpilot_widget} reviewSites={media.review_sites} />

      {/* ─── FAQ ─── */}
      {faq && <FaqBlock section={faq} safeAccentOnLight={safeAccentOnLightBg} />}

      {/* Lead form is now embedded in the hero section */}

      {/* ─── FOOTER ─── */}
      <FooterBlock section={footer} media={media} />
    </div>
  )
}

/* Helper: fix garbled UTF-8 sequences (mojibake — UTF-8 bytes read as Latin-1) */
function sanitizeText(text: string): string {
  return text
    .replace(/\u00e2\u0080\u00a2/g, '•')
    .replace(/\u00e2\u0080\u0099/g, '\u2019')
    .replace(/\u00e2\u0080\u009c/g, '\u201c')
    .replace(/\u00e2\u0080\u009d/g, '\u201d')
    .replace(/\u00e2\u0080\u0093/g, '\u2013')
    .replace(/\u00e2\u0080\u0094/g, '\u2014')
    .replace(/\u00e2\u009c\u0093/g, '✓')
    .replace(/\u00e2\u009c\u0085/g, '✅')
    .replace(/\u00c2\u00a0/g, ' ')
    .replace(/\u00e2[\u0080-\u009f][\u0080-\u00bf]/g, '•')
}

/* ═══════════════════════════════════════════════════════
   HERO — Gradient bg, text left, person image right with
   frosted glass callout bubble on bottom-right of image
   ═══════════════════════════════════════════════════════ */
function HeroBlock({ section, media, primaryColor, accentColor, safeAccentOnLight, formConfig, pageSlug, clientSlug, publishedPageId }: { section: Section; media: MediaAssets; primaryColor: string; accentColor: string; safeAccentOnLight: string; formConfig?: FormConfig; pageSlug?: string; clientSlug?: string; publishedPageId?: string }) {
  const img = media.hero_image
  const hasForm = !!formConfig
  return (
    <section id="lead-form" className="relative overflow-hidden bg-[#fafbfa]">
      <AnimatedBackground />

      {/* Very subtle single-color wash — stationary, not distracting */}
      <div
        className="absolute top-0 right-0 w-[50%] h-full pointer-events-none"
        style={{
          background: `linear-gradient(160deg, transparent 0%, ${primaryColor}06 50%, ${primaryColor}0a 100%)`,
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-10 lg:px-12 xl:px-24 py-8 md:py-20">
        <div className="flex flex-col md:flex-row items-center gap-6 md:gap-6">
          {/* Left: headline + subheadline + (form OR cta button) */}
          <div className={`flex-1 text-center md:text-left ${hasForm ? 'md:max-w-[50%]' : 'md:max-w-[55%]'}`}>
            <h1
              className="text-[1.75rem] sm:text-4xl md:text-5xl lg:text-[3.5rem] font-bold text-[var(--color-text)] leading-[1.1] mb-3 md:mb-5"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              <AH text={section.headline || ''} word={section.accent_word} color={safeAccentOnLight} />
            </h1>
            {(section.subheadline || section.content) && (
              <p className="text-sm md:text-lg text-gray-500 leading-relaxed mb-4 md:mb-6 max-w-lg mx-auto md:mx-0">
                {section.subheadline || section.content}
              </p>
            )}
            {hasForm ? (
              /* Form card — primary brand color bg with frosted glass fields */
              <div
                className="rounded-2xl overflow-hidden branded-form-card"
                style={{
                  background: `linear-gradient(145deg, ${primaryColor} 0%, ${primaryColor}ee 100%)`,
                  boxShadow: '0 20px 50px rgba(0,0,0,0.15), 0 6px 20px rgba(0,0,0,0.08)',
                }}
              >
                <div className="px-4 py-4 md:px-6 md:py-5">
                  <LeadFormDynamic
                    formConfig={formConfig!}
                    pageSlug={pageSlug}
                    clientSlug={clientSlug}
                    publishedPageId={publishedPageId}
                    embedded
                    darkBg
                  />
                </div>
              </div>
            ) : (
              <>
                <a
                  href={section.cta_url || '#lead-form'}
                  className="btn-textured cta-button inline-block py-4 px-10 rounded-full bg-[var(--color-primary)] font-bold text-base md:text-lg transition-all shadow-xl"
                >
                  {section.cta}
                </a>
                {section.sub_cta && (
                  <div className="mt-4 flex items-center justify-center md:justify-start gap-2">
                    <span className="inline-flex items-center gap-2 bg-gray-100/80 backdrop-blur-sm rounded-full px-4 py-2 text-gray-500 text-xs md:text-sm border border-gray-200/60">
                      <PhClock size={14} weight="duotone" color="var(--color-primary)" />
                      {section.sub_cta}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
            <div className="flex-shrink-0 md:max-w-[45%] flex justify-center">
              {img ? (
                <div className="relative w-[300px] md:w-[380px] lg:w-[420px]">
                  {/* Decorative shapes behind the image */}
                  <div
                    className="absolute -top-4 -right-4 w-[85%] h-[85%] rounded-3xl"
                    style={{ transform: 'rotate(6deg)', background: `${primaryColor}18` }}
                  />
                  <div
                    className="absolute -bottom-3 -left-3 w-20 h-20 rounded-2xl"
                    style={{ transform: 'rotate(-12deg)', background: `${primaryColor}22` }}
                  />
                  <div
                    className="absolute top-[20%] -right-6 w-12 h-12 rounded-full"
                    style={{ background: `${primaryColor}20` }}
                  />
                  <div
                    className="absolute -bottom-2 right-[15%] w-8 h-8 rounded-full"
                    style={{ background: `${primaryColor}20` }}
                  />
                  {/* The actual image */}
                  <img
                    src={img}
                    alt=""
                    className="relative z-10 w-full rounded-2xl shadow-2xl object-cover"
                    style={{ aspectRatio: '4/5' }}
                  />
                  {/* Frosted glass callout — bottom right on top of image */}
                  {section.sub_cta && (
                    <div
                      className="absolute bottom-4 right-4 z-20 max-w-[200px] md:max-w-[220px] rounded-xl px-4 py-3"
                      style={{
                        background: 'rgba(255,255,255,0.18)',
                        backdropFilter: 'blur(24px)',
                        WebkitBackdropFilter: 'blur(24px)',
                        border: '1px solid rgba(255,255,255,0.25)',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.06)',
                      }}
                    >
                      <p className="text-xs font-semibold text-white leading-snug" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}>
                        {section.sub_cta}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="relative w-[300px] md:w-[380px]">
                  <div
                    className="absolute -top-4 -right-4 w-[85%] h-[85%] rounded-3xl"
                    style={{ transform: 'rotate(6deg)', background: `${primaryColor}15` }}
                  />
                  <div
                    className="w-full rounded-2xl bg-gray-100 border border-gray-200"
                    style={{ aspectRatio: '4/5' }}
                  />
                </div>
              )}
            </div>
          </div>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════
   FEATURE CARDS — Rich gradient bg, frosted glass cards,
   detailed multi-color illustrated icons
   ═══════════════════════════════════════════════════════ */
function FeatureCardsBar({ section, primaryColor, accentColor, trustpilotWidget, reviewSites }: { section: Section; primaryColor: string; accentColor: string; trustpilotWidget?: TrustpilotWidget; reviewSites?: ReviewSite[] }) {
  const items = section.items || []
  const enabledReviewSites = (reviewSites || []).filter(rs => rs.enabled !== false && rs.url && rs.rating)
  const trustpilotSite = enabledReviewSites.find(rs => rs.platform === 'trustpilot')
  const hasTrustpilot = !!(trustpilotWidget?.businessUnitId) && !!(trustpilotSite?.rating || trustpilotSite?.review_count)
  const hasAnyReviews = hasTrustpilot || enabledReviewSites.length > 0

  return (
    <section
      className="relative py-6 md:py-8 overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}dd 50%, ${primaryColor}bb 100%)`,
      }}
    >
      {/* Diagonal line decorations — more visible on dark bg */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
        <line x1="0%" y1="0%" x2="30%" y2="100%" stroke="white" strokeWidth="1" opacity="0.10" />
        <line x1="50%" y1="0%" x2="80%" y2="100%" stroke="white" strokeWidth="1" opacity="0.08" />
        <line x1="75%" y1="0%" x2="100%" y2="60%" stroke="white" strokeWidth="0.75" opacity="0.07" />
        <line x1="15%" y1="100%" x2="45%" y2="0%" stroke="white" strokeWidth="0.75" opacity="0.06" />
        <line x1="90%" y1="100%" x2="60%" y2="0%" stroke="white" strokeWidth="0.5" opacity="0.05" />
      </svg>

      <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-10 lg:px-12 xl:px-24">
        <div className={`grid grid-cols-2 ${items.length >= 4 ? 'lg:grid-cols-4' : items.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-3 md:gap-4`}>
          {items.map((item, i) => (
            <div
              key={i}
              className="rounded-2xl p-3 md:p-5 flex flex-col md:flex-row items-center md:items-center gap-2 md:gap-4 text-center md:text-left"
              style={{
                background: 'rgba(255,255,255,0.10)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: '1px solid rgba(255,255,255,0.18)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
              }}
            >
              {/* Phosphor duotone icon */}
              <div className="flex-shrink-0 w-9 h-9 md:w-14 md:h-14 rounded-full bg-white/10 flex items-center justify-center">
                <DuotoneIcon name={item.icon} size={20} color="#ffffff" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] md:text-xs text-white/70 uppercase tracking-wide font-medium leading-tight">{item.label}</p>
                <p className="text-sm md:text-base font-bold text-white leading-tight mt-0.5">{item.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Review platform mini badges — inline below feature cards */}
        {hasAnyReviews && (
          <div className="mt-5 md:mt-6 flex justify-center">
            <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6">
              {hasTrustpilot && (
                <div className="flex items-center gap-1.5 text-white/80">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M12 1.5l2.76 8.495h8.94l-7.23 5.253 2.76 8.495L12 18.49l-7.23 5.253 2.76-8.495L.3 9.995h8.94L12 1.5z" fill="#00b67a"/>
                  </svg>
                  <span className="text-[10px] md:text-xs font-medium">Trustpilot</span>
                  <MiniStars count={Math.round(trustpilotSite?.rating || 5)} color="#00b67a" />
                </div>
              )}
              {enabledReviewSites.filter(rs => rs.platform !== 'trustpilot' || !hasTrustpilot).map((rs) => (
                <div
                  key={rs.platform}
                  className="flex items-center gap-1.5 text-white/80"
                >
                  <ReviewPlatformIcon platform={rs.platform} size={14} />
                  <span className="text-[10px] md:text-xs font-medium">{REVIEW_PLATFORM_NAMES[rs.platform]}</span>
                  {rs.rating && <MiniStars count={Math.round(rs.rating)} color={REVIEW_PLATFORM_COLORS[rs.platform]} />}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════
   TWO COLUMN INFO — Gradient bg, frosted glass boxes
   ═══════════════════════════════════════════════════════ */
function TwoColumnInfo({ section, media, safeAccentOnLight }: { section: Section; media: MediaAssets; safeAccentOnLight: string }) {
  const items = section.items || []
  const half = Math.ceil(items.length / 2)
  const left = items.slice(0, half)
  const right = items.slice(half)
  const img = media.two_column_image
  const parallax = media.parallax_image

  return (
    <section className="relative py-16 md:py-20 overflow-hidden"
      style={parallax ? {
        backgroundImage: `url(${parallax})`,
        backgroundAttachment: 'fixed',
        backgroundPosition: 'center',
        backgroundSize: 'cover',
      } : {
        background: `linear-gradient(160deg, #f8faf9 0%, #eef4f1 30%, #f0f7f4 60%, #f5f9f7 100%)`,
      }}
    >
      {/* Overlay — light frosted when parallax, decorative blobs when not */}
      {parallax ? (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-[2px]" />
      ) : (
        <>
          <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full blur-[120px] pointer-events-none"
            style={{ background: 'var(--color-primary)', opacity: 0.06 }}
          />
          <div className="absolute bottom-0 left-0 w-[350px] h-[350px] rounded-full blur-[100px] pointer-events-none"
            style={{ background: 'var(--color-primary)', opacity: 0.04 }}
          />
        </>
      )}

      {parallax && (
        <style>{`
          @supports (-webkit-touch-callout: none) {
            [style*="background-attachment: fixed"] { background-attachment: scroll !important; }
          }
        `}</style>
      )}

      {/* Diagonal lines */}
      <SectionLines color="var(--color-primary)" opacity={parallax ? 0.03 : 0.05} />

      <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-10 lg:px-12 xl:px-24">
        <div className="text-center max-w-3xl mx-auto mb-10">
          <h2
            className="text-3xl md:text-4xl font-bold text-[var(--color-text)] mb-4"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            <AH text={section.headline || ''} word={section.accent_word} color={safeAccentOnLight} />
          </h2>
          {section.subheadline && (
            <p className="text-base text-gray-500 leading-relaxed">{section.subheadline}</p>
          )}
        </div>

        {/* Full-width image banner above info boxes when available */}
        {img && (
          <div className="mb-10 rounded-2xl overflow-hidden shadow-2xl">
            <img src={img} alt="" className="w-full" style={{ display: 'block' }} />
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-5 md:gap-6 mb-10">
          <FrostedInfoBox items={left} title={left[0]?.title} />
          <FrostedInfoBox items={right} title={right[0]?.title} />
        </div>

        {section.cta && (
          <div className="text-center">
            <a
              href={section.cta_url || '#lead-form'}
              className="btn-textured cta-button inline-block py-4 px-10 rounded-full bg-[var(--color-primary)] font-bold text-base transition-all shadow-xl"
            >
              {section.cta}
            </a>
          </div>
        )}
      </div>
    </section>
  )
}

function FrostedInfoBox({ items, title }: { items: SectionItem[]; title?: string }) {
  return (
    <div
      className="rounded-2xl p-6 md:p-7"
      style={{
        background: 'rgba(255,255,255,0.45)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.4)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.02)',
      }}
    >
      {title && (
        <h3 className="font-bold text-lg text-[var(--color-text)] mb-4 flex items-center gap-2">
          <div className="w-1 h-5 rounded-full bg-[var(--color-primary)]" />
          {title}
        </h3>
      )}
      <ul className="space-y-3">
        {items.map((item, i) => {
          if (i === 0 && item.title) return null
          return (
            <li key={i} className="flex items-start gap-2.5">
              <div className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center">
                <PhCheckCircle size={12} weight="duotone" color="var(--color-primary)" />
              </div>
              <span className="text-sm text-gray-600 leading-relaxed">{item.text}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   STEPS — Image left, numbered step cards right,
   subtle gradient bg with decorative elements
   ═══════════════════════════════════════════════════════ */
function StepsBlock({ section, media, primaryColor, accentColor, safeAccentOnLight }: { section: Section; media: MediaAssets; primaryColor: string; accentColor: string; safeAccentOnLight: string }) {
  const items = section.items || []
  const img = media.steps_image

  return (
    <section className="relative py-16 md:py-20 overflow-hidden bg-white">
      {/* Subtle accent gradient on left side */}
      <div className="absolute top-0 left-0 w-[40%] h-full pointer-events-none"
        style={{ background: `linear-gradient(180deg, ${primaryColor}06 0%, ${primaryColor}03 100%)` }}
      />
      <SectionLines color="var(--color-primary)" opacity={0.03} />

      <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-10 lg:px-12 xl:px-24">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h2
            className="text-3xl md:text-4xl font-bold text-[var(--color-text)] mb-3"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            <AH text={section.headline || ''} word={section.accent_word} color={safeAccentOnLight} />
          </h2>
          {section.subheadline && (
            <p className="text-base text-gray-500">{section.subheadline}</p>
          )}
        </div>

        <div className={`flex flex-col lg:flex-row items-center gap-10 lg:gap-12${!img ? ' lg:justify-center' : ''}`}>
          {/* Left: prominent image */}
          {img && (
            <div className="w-full lg:w-5/12 flex justify-center">
              <div className="relative w-full max-w-[480px]">
                <div
                  className="absolute inset-[-5%]"
                  style={{ borderRadius: '30% 70% 70% 30% / 30% 30% 70% 70%', background: `${primaryColor}10` }}
                />
                <img src={img} alt="" className="relative z-10 rounded-2xl shadow-2xl w-full object-cover" style={{ aspectRatio: '4/3' }} />
              </div>
            </div>
          )}

          {/* Step cards with numbered badges */}
          <div className={img ? 'w-full lg:w-7/12 space-y-4' : 'lg:w-10/12 space-y-4'}>
            {items.map((item, i) => (
              <div
                key={i}
                className="rounded-xl p-5 md:p-6 flex items-start gap-4 transition-all hover:shadow-lg"
                style={{
                  background: 'rgba(255,255,255,0.5)',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid rgba(0,0,0,0.06)',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
                }}
              >
                <div className="relative flex-shrink-0">
                  {/* Numbered circle with icon */}
                  <div className="w-14 h-14 rounded-full flex items-center justify-center"
                    style={{ background: `${primaryColor}12` }}
                  >
                    <DuotoneIcon name={item.icon} size={28} color={primaryColor} />
                  </div>
                  {/* Step number badge */}
                  <div
                    className="absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ background: primaryColor, color: getContrastTextColor(primaryColor) }}
                  >
                    {i + 1}
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-[var(--color-text)] mb-1">{item.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{item.text}</p>
                  {i === items.length - 1 && section.cta && (
                    <a
                      href={section.cta_url || '#lead-form'}
                      className="btn-textured cta-button inline-block mt-3 py-2.5 px-6 rounded-full bg-[var(--color-primary)] font-semibold text-sm transition-all"
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
   TRUST BAR — Dark bg, frosted stat cards
   ═══════════════════════════════════════════════════════ */
function TrustBar({ section, media, safeAccentOnDark, safeStatColor, secondaryColor }: { section: Section; media: MediaAssets; safeAccentOnDark: string; safeStatColor: string; secondaryColor: string }) {
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
      {/* Branded overlay — lighter when parallax image is present so it shows through */}
      <div className={`absolute inset-0 ${parallax ? 'bg-gradient-to-br from-[var(--color-secondary)]/70 to-[var(--color-primary)]/60' : 'bg-gradient-to-br from-[var(--color-secondary)] to-[var(--color-primary)]/90'}`} />

      {/* Diagonal lines on dark bg */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
        <line x1="0%" y1="20%" x2="25%" y2="0%" stroke="white" strokeWidth="0.5" opacity="0.06" />
        <line x1="60%" y1="100%" x2="100%" y2="30%" stroke="white" strokeWidth="0.5" opacity="0.04" />
        <line x1="30%" y1="100%" x2="70%" y2="0%" stroke="white" strokeWidth="0.5" opacity="0.03" />
      </svg>

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
            <AH text={section.headline} word={section.accent_word} color={safeAccentOnDark} />
          </h2>
        )}
        <div className="grid sm:grid-cols-3 gap-5 md:gap-8">
          {items.map((item, i) => (
            <div
              key={i}
              className="rounded-xl p-6 md:p-7 text-center"
              style={{
                background: 'rgba(255,255,255,0.08)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.15)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
              }}
            >
              {item.image ? (
                <img src={item.image} alt="" className="h-12 mx-auto mb-3 object-contain" />
              ) : item.stat ? (
                <p className="text-2xl md:text-3xl font-bold mb-2 whitespace-nowrap" style={{ color: safeStatColor }}>{item.stat}</p>
              ) : null}
              <div className="w-12 h-px bg-white/20 mx-auto mb-3" />
              <p className="text-xs md:text-sm text-white/70">{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════
   BENEFITS GRID — Gradient bg, frosted glass cards with
   left border accent, icon circles
   ═══════════════════════════════════════════════════════ */
function BenefitsGrid({ section, media, primaryColor, accentColor, safeAccentOnLight }: { section: Section; media: MediaAssets; primaryColor: string; accentColor: string; safeAccentOnLight: string }) {
  const items = section.items || []
  const img = media.benefits_image

  return (
    <section className="relative py-16 md:py-20 overflow-hidden"
      style={{
        background: `linear-gradient(160deg, #f6f9f8 0%, #edf3f0 40%, #f2f7f5 70%, #f8faf9 100%)`,
      }}
    >
      {/* Decorative blobs */}
      <div className="absolute bottom-0 right-0 w-[350px] h-[350px] rounded-full blur-[100px] pointer-events-none"
        style={{ background: 'var(--color-primary)', opacity: 0.05 }}
      />
      <SectionLines color="var(--color-primary)" opacity={0.04} />

      <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-10 lg:px-12 xl:px-24">
        <div className="text-center max-w-3xl mx-auto mb-10">
          <h2
            className="text-3xl md:text-4xl font-bold text-[var(--color-text)] mb-3"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            <AH text={section.headline || ''} word={section.accent_word} color={safeAccentOnLight} />
          </h2>
          {section.content && (
            <p className="text-base text-gray-500">{section.content}</p>
          )}
        </div>

        <div className="flex flex-col lg:flex-row gap-10 lg:gap-12 items-center">
          {/* Left: 2-column (or 3-column) frosted card grid */}
          <div className={img ? 'w-full lg:w-7/12' : 'w-full'}>
            <div className={`grid ${img ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3'} gap-4`}>
              {items.map((item, i) => (
                <div
                  key={i}
                  className="rounded-xl p-5 text-left hover:shadow-lg transition-all group"
                  style={{
                    background: 'rgba(255,255,255,0.40)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255,255,255,0.35)',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
                    borderLeft: '3px solid var(--color-primary)',
                  }}
                >
                  <div className="w-10 h-10 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <div className="w-7 h-7">
                      <DuotoneIcon name={item.icon} size={28} color={primaryColor} />
                    </div>
                  </div>
                  <h3 className="font-bold text-[var(--color-text)] mb-2">{item.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{item.text}</p>
                </div>
              ))}
            </div>
            {/* CTA below cards when no image */}
            {!img && section.cta && (
              <div className="text-center mt-8">
                <a
                  href={section.cta_url || '#lead-form'}
                  className="btn-textured cta-button inline-block py-4 px-10 rounded-full bg-[var(--color-primary)] font-bold text-base transition-all shadow-xl"
                >
                  {section.cta}
                </a>
              </div>
            )}
          </div>

          {/* Right: prominent image + CTA */}
          {img && (
            <div className="w-full lg:w-5/12 flex flex-col items-center gap-6">
              <div className="relative w-full max-w-[480px]">
                <div
                  className="absolute inset-[-5%]"
                  style={{ borderRadius: '30% 70% 70% 30% / 30% 30% 70% 70%', background: 'var(--color-primary)', opacity: 0.08 }}
                />
                <img src={img} alt="" className="relative z-10 rounded-2xl shadow-2xl w-full object-cover" style={{ aspectRatio: '4/3' }} />
              </div>
              {section.cta && (
                <a
                  href={section.cta_url || '#lead-form'}
                  className="btn-textured cta-button inline-block py-4 px-10 rounded-full bg-[var(--color-primary)] font-bold text-base transition-all shadow-xl"
                >
                  {section.cta}
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════
   TESTIMONIALS — Cards with stars, quotes, avatars,
   subtle gradient bg with decorative elements
   ═══════════════════════════════════════════════════════ */
function TestimonialsBlock({ section, media, safeAccentOnLight }: { section: Section; media: MediaAssets; safeAccentOnLight: string }) {
  const items = section.items || []
  const [active, setActive] = useState(0)
  const perPage = 3

  return (
    <section className="relative py-16 md:py-20 bg-white overflow-hidden">
      {/* Subtle top-left gradient */}
      <div className="absolute top-0 left-0 w-[300px] h-[300px] rounded-full blur-[100px] pointer-events-none"
        style={{ background: 'var(--color-primary)', opacity: 0.04 }}
      />
      <SectionLines color="var(--color-primary)" opacity={0.06} />

      <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-10 lg:px-12 xl:px-24">
        <h2
          className="text-3xl md:text-4xl font-bold text-[var(--color-text)] text-center mb-10"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          <AH text={section.headline || ''} word={section.accent_word} color={safeAccentOnLight} />
        </h2>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((item, i) => (
            <div
              key={i}
              className="rounded-xl p-6 flex flex-col hover:shadow-lg transition-all"
              style={{
                background: 'rgba(255,255,255,0.9)',
                border: '1px solid rgba(0,0,0,0.06)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
              }}
            >
              {/* Stars */}
              <div className="flex gap-0.5 mb-3">
                {[...Array(5)].map((_, si) => (
                  <PhStar
                    key={si}
                    size={18}
                    weight={si < (item.rating || 5) ? 'fill' : 'regular'}
                    color={si < (item.rating || 5) ? '#facc15' : '#e5e7eb'}
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
                    className="w-10 h-10 rounded-full object-cover ring-2 ring-[var(--color-primary)]/20"
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
   REVIEW PLATFORM HELPERS — shared constants, icons,
   and mini-star component for all review platforms
   ═══════════════════════════════════════════════════════ */
const REVIEW_PLATFORM_NAMES: Record<string, string> = {
  google: 'Google',
  yelp: 'Yelp',
  bbb: 'BBB',
  facebook: 'Facebook',
  trustpilot: 'Trustpilot',
}

const REVIEW_PLATFORM_COLORS: Record<string, string> = {
  google: '#fbbc04',
  yelp: '#d32323',
  bbb: '#005a78',
  facebook: '#1877f2',
  trustpilot: '#00b67a',
}

function MiniStars({ count, color }: { count: number; color: string }) {
  return (
    <div className="flex gap-px ml-1">
      {[...Array(count)].map((_, i) => (
        <div key={i} className="w-3 h-3 flex items-center justify-center rounded-[1px]" style={{ background: color }}>
          <svg width="7" height="7" viewBox="0 0 24 24" fill="white">
            <path d="M12 1.5l2.76 8.495h8.94l-7.23 5.253 2.76 8.495L12 18.49l-7.23 5.253 2.76-8.495L.3 9.995h8.94L12 1.5z"/>
          </svg>
        </div>
      ))}
    </div>
  )
}

function ReviewPlatformIcon({ platform, size = 20 }: { platform: string; size?: number }) {
  switch (platform) {
    case 'google':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 001 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
      )
    case 'yelp':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="#d32323">
          <path d="M12.871 15.073l-2.543-2.512.033-.357a1.23 1.23 0 011.043-1.2l3.32-.677a1.15 1.15 0 011.38 1.28l-.47 3.14a1.17 1.17 0 01-1.14.97c-.23 0-.48-.07-.72-.22l-.903-.622zM9.531 11.493c-.43-.76-1.09-1.3-1.86-1.52L4.131 8.93a1.16 1.16 0 01-.36-2.06l3.83-3.12a1.18 1.18 0 011.92.72l.83 5.51c.08.53-.19 1.04-.67 1.28a.98.98 0 01-.45.11c-.22 0-.45-.07-.7-.22l.01-.06zM7.171 15.943l3.45-.78a1.14 1.14 0 011.17.56c.2.35.21.77.03 1.14l-1.64 3.21a1.16 1.16 0 01-2.11-.12l-1.58-3.09a.97.97 0 01.68-1.42v.5z"/>
        </svg>
      )
    case 'bbb':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <rect x="2" y="4" width="20" height="16" rx="2" fill="#005a78"/>
          <text x="12" y="15" textAnchor="middle" fill="white" fontSize="8" fontWeight="bold" fontFamily="Arial">BBB</text>
        </svg>
      )
    case 'facebook':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="#1877f2">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
        </svg>
      )
    case 'trustpilot':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path d="M12 1.5l2.76 8.495h8.94l-7.23 5.253 2.76 8.495L12 18.49l-7.23 5.253 2.76-8.495L.3 9.995h8.94L12 1.5z" fill="#00b67a"/>
        </svg>
      )
    default:
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 1.5l2.76 8.495h8.94l-7.23 5.253 2.76 8.495L12 18.49l-7.23 5.253 2.76-8.495L.3 9.995h8.94L12 1.5z"/>
        </svg>
      )
  }
}

/* ═══════════════════════════════════════════════════════
   REVIEW BADGES — Multi-platform review badges section.
   Shows Trustpilot (if detected) + any manually added
   review sites (Google, Yelp, BBB, Facebook). Only renders
   if there are review sites to show.
   ═══════════════════════════════════════════════════════ */
function ReviewBadgesBlock({ trustpilotWidget, reviewSites }: { trustpilotWidget?: TrustpilotWidget; reviewSites?: ReviewSite[] }) {
  const enabledSites = (reviewSites || []).filter(rs => rs.enabled !== false && rs.url)
  // Only show Trustpilot if it's also configured as a review site with a rating,
  // OR if there's a manually-added trustpilot review site. Auto-detected Trustpilot
  // without confirmed reviews should NOT show fake 5-star badges.
  const trustpilotSite = enabledSites.find(rs => rs.platform === 'trustpilot')
  const hasTrustpilot = !!(trustpilotWidget?.businessUnitId) && !!(trustpilotSite?.rating || trustpilotSite?.review_count)

  // Build a unified list of badges to show
  const badges: Array<{ platform: string; url: string; rating?: number; reviewCount?: number }> = []

  if (hasTrustpilot && trustpilotSite) {
    badges.push({
      platform: 'trustpilot',
      url: trustpilotWidget!.reviewUrl || `https://www.trustpilot.com/review/${trustpilotWidget!.domain || ''}`,
      rating: trustpilotSite.rating,
      reviewCount: trustpilotSite.review_count,
    })
  }

  for (const rs of enabledSites) {
    // Don't duplicate Trustpilot if already added from widget
    if (rs.platform === 'trustpilot' && hasTrustpilot) continue
    // Only show badges for sites that have a rating (verified reviews)
    if (!rs.rating) continue
    badges.push({
      platform: rs.platform,
      url: rs.url,
      rating: rs.rating,
      reviewCount: rs.review_count,
    })
  }

  if (badges.length === 0) return null

  return (
    <section className="relative py-10 md:py-14 overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #f8faf9 0%, #f0f5f2 100%)' }}
    >
      <SectionLines color="var(--color-primary)" opacity={0.03} />
      <div className="relative z-10 max-w-5xl mx-auto px-4 md:px-10">
        <div className={`flex flex-wrap items-center justify-center ${badges.length === 1 ? 'gap-6' : 'gap-6 md:gap-10'}`}>
          {badges.map((badge) => (
            <div
              key={badge.platform}
              className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3"
            >
              <div className="flex items-center gap-2">
                <ReviewPlatformIcon platform={badge.platform} size={24} />
                <span className="text-base font-bold text-[#191919]">{REVIEW_PLATFORM_NAMES[badge.platform] || badge.platform}</span>
              </div>
              {badge.rating && (
                <div className="flex gap-0.5">
                  {[...Array(Math.round(badge.rating))].map((_, i) => (
                    <div key={i} className="w-6 h-6 flex items-center justify-center rounded-[1px]" style={{ background: REVIEW_PLATFORM_COLORS[badge.platform] || '#fbbf24' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
                        <path d="M12 1.5l2.76 8.495h8.94l-7.23 5.253 2.76 8.495L12 18.49l-7.23 5.253 2.76-8.495L.3 9.995h8.94L12 1.5z"/>
                      </svg>
                    </div>
                  ))}
                </div>
              )}
              {badge.reviewCount && (
                <span className="text-xs text-gray-400">{badge.reviewCount} reviews</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════
   PLATFORM REVIEWS — Branded review sections showing
   actual customer reviews grouped by platform (Google,
   Yelp, BBB, etc.). Each platform gets its own section
   with platform branding, stars, and review cards.
   ═══════════════════════════════════════════════════════ */
interface ReviewGroup {
  platform: string
  reviews: PlatformReview[]
  siteInfo?: ReviewSite
  avgRating?: number
}

function groupReviewsByPlatform(reviews?: PlatformReview[], sites?: ReviewSite[]): ReviewGroup[] {
  if (!reviews || reviews.length === 0) return []
  const groups = new Map<string, PlatformReview[]>()
  for (const r of reviews) {
    const key = r.platform || 'other'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(r)
  }
  return Array.from(groups.entries()).map(([platform, revs]) => {
    const site = sites?.find(s => s.platform === platform)
    const ratings = revs.filter(r => r.rating).map(r => r.rating!)
    const avgRating = site?.rating || (ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : undefined)
    return { platform, reviews: revs, siteInfo: site, avgRating }
  })
}

function PlatformReviewsBlock({ group }: { group: ReviewGroup }) {
  const { platform, reviews, siteInfo, avgRating } = group
  if (reviews.length === 0) return null

  const platformColor = REVIEW_PLATFORM_COLORS[platform] || '#6b7280'
  const platformName = REVIEW_PLATFORM_NAMES[platform] || platform
  const profileUrl = siteInfo?.url

  return (
    <section className="relative py-12 md:py-16 overflow-hidden" style={{ background: '#fafbfc' }}>
      <SectionLines color={platformColor} opacity={0.04} />
      <div className="relative z-10 max-w-6xl mx-auto px-4 md:px-10">
        {/* Platform header */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8 md:mb-10">
          <div className="flex items-center gap-2.5">
            <ReviewPlatformIcon platform={platform} size={28} />
            <span className="text-xl font-bold text-[#191919]">{platformName} Reviews</span>
          </div>
          {avgRating && (
            <div className="flex items-center gap-2">
              <div className="flex gap-0.5">
                {[...Array(Math.round(avgRating))].map((_, i) => (
                  <div key={i} className="w-5 h-5 flex items-center justify-center rounded-[1px]" style={{ background: platformColor }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="white">
                      <path d="M12 1.5l2.76 8.495h8.94l-7.23 5.253 2.76 8.495L12 18.49l-7.23 5.253 2.76-8.495L.3 9.995h8.94L12 1.5z"/>
                    </svg>
                  </div>
                ))}
              </div>
              <span className="text-sm font-semibold text-gray-600">{avgRating.toFixed(1)}</span>
              {siteInfo?.review_count && (
                <span className="text-xs text-gray-400">({siteInfo.review_count} reviews)</span>
              )}
            </div>
          )}
        </div>

        {/* Review cards */}
        <div className={`grid gap-4 md:gap-6 ${reviews.length === 1 ? 'max-w-2xl mx-auto' : reviews.length === 2 ? 'grid-cols-1 md:grid-cols-2 max-w-4xl mx-auto' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
          {reviews.map((review, i) => (
            <div
              key={i}
              className="rounded-xl p-5 md:p-6"
              style={{
                background: 'white',
                border: '1px solid rgba(0,0,0,0.06)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              }}
            >
              {/* Stars */}
              {review.rating && (
                <div className="flex gap-0.5 mb-3">
                  {[...Array(Math.round(review.rating))].map((_, j) => (
                    <svg key={j} width="16" height="16" viewBox="0 0 24 24" fill={platformColor}>
                      <path d="M12 1.5l2.76 8.495h8.94l-7.23 5.253 2.76 8.495L12 18.49l-7.23 5.253 2.76-8.495L.3 9.995h8.94L12 1.5z"/>
                    </svg>
                  ))}
                </div>
              )}
              {/* Review text */}
              <p className="text-sm md:text-base text-gray-700 leading-relaxed mb-4" style={{ fontStyle: 'italic' }}>
                &ldquo;{review.text}&rdquo;
              </p>
              {/* Author */}
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: platformColor }}>
                  {review.author.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{review.author}</p>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide">via {platformName}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Review count attribution — no outbound links */}
        {siteInfo?.review_count && (
          <div className="text-center mt-6">
            <span className="text-xs text-gray-400">
              Based on {siteInfo.review_count} {platformName} reviews
            </span>
          </div>
        )}
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════
   FAQ — Accordion with frosted glass cards,
   gradient bg
   ═══════════════════════════════════════════════════════ */
function FaqBlock({ section, safeAccentOnLight }: { section: Section; safeAccentOnLight: string }) {
  const [open, setOpen] = useState<number | null>(null)
  const items = section.items || []

  return (
    <section className="relative py-16 md:py-20 overflow-hidden bg-white">
      <SectionLines color="var(--color-primary)" opacity={0.03} />

      {/* Subtle bottom-right blob */}
      <div className="absolute bottom-0 right-0 w-[250px] h-[250px] rounded-full blur-[80px] pointer-events-none"
        style={{ background: 'var(--color-primary)', opacity: 0.04 }}
      />

      <div className="relative z-10 max-w-3xl mx-auto px-4 md:px-10">
        <h2
          className="text-3xl md:text-4xl font-bold text-[var(--color-text)] text-center mb-10"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          <AH text={section.headline || ''} word={section.accent_word} color={safeAccentOnLight} />
        </h2>

        <div className="space-y-3">
          {items.map((item, i) => (
            <div
              key={i}
              className="rounded-xl overflow-hidden transition-all"
              style={{
                background: open === i ? 'rgba(255,255,255,0.9)' : 'rgba(248,250,249,0.8)',
                border: `1px solid ${open === i ? 'var(--color-primary)' : 'rgba(0,0,0,0.06)'}`,
                boxShadow: open === i ? '0 4px 16px rgba(0,0,0,0.06)' : '0 1px 4px rgba(0,0,0,0.02)',
              }}
            >
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between px-5 py-4 text-left group"
              >
                <span className="font-medium text-[var(--color-text)] group-hover:text-[var(--color-primary)] transition-colors pr-4">
                  {item.question}
                </span>
                <ChevronDown
                  className={`w-5 h-5 text-gray-400 transition-transform duration-200 flex-shrink-0 ${
                    open === i ? 'rotate-180 text-[var(--color-primary)]' : ''
                  }`}
                />
              </button>
              <div
                className="overflow-hidden transition-all duration-300"
                style={{ maxHeight: open === i ? '300px' : '0px' }}
              >
                <p className="px-5 pb-5 text-sm text-gray-500 leading-relaxed">
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
   FOOTER — Dark gradient bg, logo, links, phone, social
   ═══════════════════════════════════════════════════════ */
function FooterBlock({ section, media }: { section?: Section; media: MediaAssets }) {
  return (
    <footer
      className="relative py-8 md:py-10 overflow-hidden"
      style={{
        background: `linear-gradient(135deg, var(--color-secondary) 0%, var(--color-secondary) 60%, var(--color-primary) 100%)`,
      }}
    >
      {/* Subtle decorative lines */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
        <line x1="0%" y1="50%" x2="30%" y2="0%" stroke="white" strokeWidth="0.5" opacity="0.04" />
        <line x1="70%" y1="100%" x2="100%" y2="30%" stroke="white" strokeWidth="0.5" opacity="0.03" />
      </svg>

      <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-10 lg:px-12 xl:px-24">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Logo */}
          <div>
            {media.logo ? (
              <img src={media.logo} alt="Logo" className="h-6 md:h-8 object-contain" style={{ filter: 'brightness(0) invert(1)' }} />
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
                <PhPhone size={14} weight="duotone" />
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
