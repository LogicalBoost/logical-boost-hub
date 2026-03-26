// Template Renderer — generates self-contained HTML landing pages
// from structured section data + brand kit.
// Used by Supabase Edge Functions (Deno runtime).
// Premium agency-quality design with glassmorphism, gradients, animations.

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PageSectionData {
  id: string
  type: string
  order: number
  content: Record<string, unknown>
}

export interface BrandKit {
  colors?: {
    primary_color?: string
    secondary_color?: string
    accent_color?: string
    background_color?: string
    text_color?: string
  }
  typography?: {
    heading_font?: string
    body_font?: string
  }
  button_style?: {
    shape?: string
    color?: string
    text_color?: string
  }
  visual_identity?: {
    overall_style?: string
  }
}

export interface Offer {
  conversion_type: 'lead_form' | 'phone_call' | 'booking' | 'purchase'
  primary_cta: string | null
}

type TemplateId =
  | 'clean_authority'
  | 'bold_conversion'
  | 'gap_play'
  | 'aggressive_dr'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function esc(text: unknown): string {
  if (text === null || text === undefined) return ''
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function raw(text: unknown): string {
  if (text === null || text === undefined) return ''
  return String(text)
}

/** Get a content field with a fallback. */
function cf<T>(content: Record<string, unknown>, key: string, fallback: T): T {
  const val = content[key]
  if (val === undefined || val === null) return fallback
  return val as T
}

/** Build a Google Fonts link tag for the two fonts. */
function googleFontsLink(heading: string, body: string): string {
  const families: string[] = []
  const addFont = (f: string) => {
    if (f && f !== 'system-ui' && f !== 'sans-serif') {
      families.push(f.replace(/ /g, '+') + ':wght@300;400;500;600;700;800;900')
    }
  }
  addFont(heading)
  if (body !== heading) addFont(body)
  if (families.length === 0) return ''
  return `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?${families.map(f => `family=${f}`).join('&')}&display=swap" rel="stylesheet">`
}

/** Hex to RGB string helper */
function hexToRgb(hex: string): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16) || 0
  const g = parseInt(h.substring(2, 4), 16) || 0
  const b = parseInt(h.substring(4, 6), 16) || 0
  return `${r}, ${g}, ${b}`
}

/** Resolve CSS custom properties from brand kit with sensible defaults. */
function cssVars(bk: BrandKit): string {
  const primary = bk.colors?.primary_color || '#6366f1'
  const secondary = bk.colors?.secondary_color || '#8b5cf6'
  const accent = bk.colors?.accent_color || '#f59e0b'
  const bg = bk.colors?.background_color || '#0a0a0f'
  const text = bk.colors?.text_color || '#f1f5f9'
  const headingFont = bk.typography?.heading_font || 'Inter'
  const bodyFont = bk.typography?.body_font || 'Inter'
  const btnRadius =
    bk.button_style?.shape === 'rounded'
      ? '100px'
      : bk.button_style?.shape === 'square'
        ? '8px'
        : '100px'
  const btnColor = bk.button_style?.color || primary
  const btnText = bk.button_style?.text_color || '#ffffff'
  const primaryRgb = hexToRgb(primary)
  const secondaryRgb = hexToRgb(secondary)
  const accentRgb = hexToRgb(accent)

  return `
  :root {
    --brand-primary: ${primary};
    --brand-secondary: ${secondary};
    --brand-accent: ${accent};
    --brand-bg: ${bg};
    --brand-text: ${text};
    --heading-font: '${headingFont}', system-ui, sans-serif;
    --body-font: '${bodyFont}', system-ui, sans-serif;
    --btn-radius: ${btnRadius};
    --btn-color: ${btnColor};
    --btn-text: ${btnText};
    --primary-rgb: ${primaryRgb};
    --secondary-rgb: ${secondaryRgb};
    --accent-rgb: ${accentRgb};

    /* Surfaces — dark theme */
    --surface-1: #12121a;
    --surface-2: #1a1a2e;
    --surface-3: #16213e;
    --surface-light: #f8fafc;
    --surface-light-2: #f1f5f9;
    --border-subtle: rgba(255,255,255,0.06);
    --border-glass: rgba(255,255,255,0.1);
    --text-muted: rgba(255,255,255,0.6);
    --text-dim: rgba(255,255,255,0.4);

    /* Shadows */
    --shadow-sm: 0 1px 2px rgba(0,0,0,0.2);
    --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.3), 0 2px 4px -2px rgba(0,0,0,0.2);
    --shadow-lg: 0 10px 25px -5px rgba(0,0,0,0.4), 0 8px 10px -6px rgba(0,0,0,0.3);
    --shadow-xl: 0 20px 50px -12px rgba(0,0,0,0.5);
    --shadow-glow: 0 0 30px rgba(${primaryRgb}, 0.3), 0 0 60px rgba(${primaryRgb}, 0.1);
    --shadow-glow-accent: 0 0 30px rgba(${accentRgb}, 0.3);
    --shadow-btn: 0 4px 15px rgba(${primaryRgb}, 0.4), 0 1px 3px rgba(0,0,0,0.2);

    /* Radii */
    --radius-sm: 8px;
    --radius-md: 16px;
    --radius-lg: 24px;
    --radius-xl: 32px;

    /* Transitions */
    --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
    --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
    --transition-fast: 0.2s var(--ease-out-expo);
    --transition: 0.4s var(--ease-out-expo);
    --transition-slow: 0.8s var(--ease-out-expo);
  }`
}

// ---------------------------------------------------------------------------
// Shared base CSS (reset + typography + glassmorphism + animations)
// ---------------------------------------------------------------------------

const BASE_CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; -webkit-text-size-adjust: 100%; }
  body {
    font-family: var(--body-font);
    color: var(--brand-text);
    background: var(--brand-bg);
    line-height: 1.7;
    font-weight: 400;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    overflow-x: hidden;
  }
  img { max-width: 100%; display: block; }
  a { color: var(--brand-primary); text-decoration: none; transition: color var(--transition-fast); }
  a:hover { color: var(--brand-secondary); }
  h1, h2, h3, h4, h5, h6 {
    font-family: var(--heading-font);
    font-weight: 800;
    color: var(--brand-text);
    letter-spacing: -0.02em;
  }
  h1 { font-size: clamp(2.5rem, 6vw, 4.5rem); line-height: 1.08; }
  h2 { font-size: clamp(1.8rem, 4vw, 3rem); line-height: 1.12; }
  h3 { font-size: clamp(1.2rem, 2.5vw, 1.5rem); line-height: 1.2; }
  p { font-size: clamp(1rem, 1.5vw, 1.15rem); line-height: 1.7; }

  /* Custom scrollbar */
  ::-webkit-scrollbar { width: 8px; }
  ::-webkit-scrollbar-track { background: var(--surface-1); }
  ::-webkit-scrollbar-thumb { background: rgba(var(--primary-rgb), 0.3); border-radius: 4px; }
  ::-webkit-scrollbar-thumb:hover { background: rgba(var(--primary-rgb), 0.5); }

  /* Containers */
  .container {
    width: 100%;
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 32px;
  }
  .container-narrow {
    width: 100%;
    max-width: 800px;
    margin: 0 auto;
    padding: 0 32px;
  }

  /* Glassmorphism base */
  .glass {
    background: rgba(255,255,255,0.04);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid var(--border-glass);
    border-radius: var(--radius-md);
  }
  .glass-strong {
    background: rgba(255,255,255,0.08);
    backdrop-filter: blur(30px);
    -webkit-backdrop-filter: blur(30px);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: var(--radius-lg);
  }

  /* Gradient text */
  .gradient-text {
    background: linear-gradient(135deg, var(--brand-primary), var(--brand-secondary), var(--brand-accent));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  /* Buttons */
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 18px 40px;
    font-family: var(--heading-font);
    font-size: clamp(0.95rem, 1.1vw, 1.1rem);
    font-weight: 700;
    border: none;
    border-radius: var(--btn-radius);
    cursor: pointer;
    transition: all var(--transition-fast);
    text-align: center;
    line-height: 1.3;
    position: relative;
    overflow: hidden;
    text-decoration: none;
    letter-spacing: 0.01em;
  }
  .btn::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(255,255,255,0.2), rgba(255,255,255,0));
    opacity: 0;
    transition: opacity var(--transition-fast);
  }
  .btn:hover::before { opacity: 1; }
  .btn:hover { transform: translateY(-3px); }
  .btn:active { transform: translateY(-1px); }
  .btn:focus-visible { outline: 3px solid var(--brand-accent); outline-offset: 3px; }

  .btn-primary {
    background: linear-gradient(135deg, var(--brand-primary), var(--brand-secondary));
    color: var(--btn-text);
    box-shadow: var(--shadow-btn);
  }
  .btn-primary:hover {
    box-shadow: 0 8px 30px rgba(var(--primary-rgb), 0.5), 0 2px 8px rgba(0,0,0,0.3);
  }

  .btn-secondary {
    background: transparent;
    color: var(--brand-text);
    border: 2px solid var(--border-glass);
    backdrop-filter: blur(10px);
  }
  .btn-secondary:hover {
    background: rgba(255,255,255,0.06);
    border-color: rgba(var(--primary-rgb), 0.4);
  }

  .btn-ghost {
    background: rgba(255,255,255,0.06);
    color: var(--brand-text);
    border: 1px solid var(--border-glass);
  }
  .btn-ghost:hover {
    background: rgba(255,255,255,0.1);
    border-color: rgba(var(--primary-rgb), 0.3);
  }

  .btn-large { padding: 22px 52px; font-size: clamp(1.05rem, 1.2vw, 1.2rem); }
  .btn-full { width: 100%; }

  /* Pill button glow animation */
  @keyframes btn-glow {
    0%, 100% { box-shadow: 0 0 20px rgba(var(--primary-rgb), 0.3); }
    50% { box-shadow: 0 0 40px rgba(var(--primary-rgb), 0.5), 0 0 60px rgba(var(--primary-rgb), 0.2); }
  }
  .btn-glow { animation: btn-glow 3s ease-in-out infinite; }

  /* Form elements — modern dark inputs */
  .form-group { margin-bottom: 20px; }
  .form-group label {
    display: block;
    font-weight: 500;
    font-size: 0.85rem;
    margin-bottom: 8px;
    color: var(--text-muted);
    letter-spacing: 0.02em;
    text-transform: uppercase;
  }
  .form-group input,
  .form-group select,
  .form-group textarea {
    width: 100%;
    padding: 16px 20px;
    font-family: var(--body-font);
    font-size: 1rem;
    border: 1.5px solid var(--border-glass);
    border-radius: var(--radius-md);
    background: rgba(255,255,255,0.04);
    color: var(--brand-text);
    transition: all var(--transition-fast);
    outline: none;
  }
  .form-group input::placeholder,
  .form-group textarea::placeholder {
    color: var(--text-dim);
  }
  .form-group input:focus,
  .form-group select:focus,
  .form-group textarea:focus {
    border-color: var(--brand-primary);
    box-shadow: 0 0 0 4px rgba(var(--primary-rgb), 0.15), 0 0 20px rgba(var(--primary-rgb), 0.1);
    background: rgba(255,255,255,0.06);
  }

  /* Utility */
  .text-center { text-align: center; }
  .text-muted { color: var(--text-muted); }
  .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); border: 0; }

  /* Eyebrow / overline labels */
  .eyebrow {
    display: inline-block;
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.15em;
    color: var(--brand-primary);
    margin-bottom: 16px;
    padding: 6px 16px;
    background: rgba(var(--primary-rgb), 0.1);
    border-radius: 100px;
    border: 1px solid rgba(var(--primary-rgb), 0.2);
  }

  /* Section spacing */
  .lp-section { padding: 100px 0; position: relative; overflow: hidden; }

  /* Noise texture overlay for dark sections */
  .noise-overlay::after {
    content: '';
    position: absolute;
    inset: 0;
    opacity: 0.03;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    background-size: 128px 128px;
    pointer-events: none;
    z-index: 0;
  }
  .noise-overlay > * { position: relative; z-index: 1; }

  /* Scroll animations */
  .animate-on-scroll {
    opacity: 0;
    transform: translateY(40px);
    transition: opacity 0.8s var(--ease-out-expo), transform 0.8s var(--ease-out-expo);
  }
  .animate-on-scroll.visible {
    opacity: 1;
    transform: translateY(0);
  }
  .animate-delay-1 { transition-delay: 0.1s; }
  .animate-delay-2 { transition-delay: 0.2s; }
  .animate-delay-3 { transition-delay: 0.3s; }
  .animate-delay-4 { transition-delay: 0.4s; }
  .animate-delay-5 { transition-delay: 0.5s; }

  /* Floating orbs — CSS-only animated background elements */
  @keyframes float-orb {
    0%, 100% { transform: translate(0, 0) scale(1); }
    25% { transform: translate(30px, -50px) scale(1.1); }
    50% { transform: translate(-20px, -80px) scale(0.95); }
    75% { transform: translate(40px, -30px) scale(1.05); }
  }
  .orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(80px);
    pointer-events: none;
    z-index: 0;
  }
  .orb-1 {
    width: 400px; height: 400px;
    background: rgba(var(--primary-rgb), 0.15);
    top: -100px; right: -100px;
    animation: float-orb 20s ease-in-out infinite;
  }
  .orb-2 {
    width: 350px; height: 350px;
    background: rgba(var(--secondary-rgb), 0.12);
    bottom: -50px; left: -100px;
    animation: float-orb 25s ease-in-out infinite reverse;
  }
  .orb-3 {
    width: 250px; height: 250px;
    background: rgba(var(--accent-rgb), 0.08);
    top: 50%; left: 50%;
    animation: float-orb 18s ease-in-out infinite 3s;
  }

  /* Gradient mesh background */
  .gradient-mesh {
    background:
      radial-gradient(ellipse at 20% 50%, rgba(var(--primary-rgb), 0.12) 0%, transparent 50%),
      radial-gradient(ellipse at 80% 20%, rgba(var(--secondary-rgb), 0.1) 0%, transparent 50%),
      radial-gradient(ellipse at 50% 80%, rgba(var(--accent-rgb), 0.06) 0%, transparent 50%),
      var(--brand-bg);
  }

  /* Urgency pulse */
  @keyframes pulse-dot {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(1.5); }
  }

  /* Gradient shift animation */
  @keyframes gradient-shift {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }

  /* Card hover lift */
  @keyframes subtle-float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-6px); }
  }

  /* Responsive */
  @media (max-width: 1024px) {
    .container { padding: 0 24px; }
    .lp-section { padding: 80px 0; }
  }
  @media (max-width: 768px) {
    .container, .container-narrow { padding: 0 20px; }
    .lp-section { padding: 64px 0; }
    .orb { display: none; }
  }
  @media (max-width: 480px) {
    .container, .container-narrow { padding: 0 16px; }
    .lp-section { padding: 48px 0; }
    .btn { padding: 16px 28px; }
    .btn-large { padding: 18px 36px; }
  }
`

// ---------------------------------------------------------------------------
// Shared JS (FAQ accordion + smooth scroll + mobile nav + scroll animations)
// ---------------------------------------------------------------------------

const SHARED_JS = `
<script>
(function(){
  // Scroll-triggered fade-in-up animations
  var observer = new IntersectionObserver(function(entries){
    entries.forEach(function(entry){
      if(entry.isIntersecting){
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
  document.querySelectorAll('.animate-on-scroll').forEach(function(el){ observer.observe(el); });

  // FAQ accordion
  document.querySelectorAll('.faq-question').forEach(function(btn){
    btn.addEventListener('click', function(){
      var item = this.closest('.faq-item');
      var isOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach(function(el){
        el.classList.remove('open');
        el.querySelector('.faq-answer').style.maxHeight = '0';
        el.querySelector('.faq-icon').textContent = '+';
      });
      if(!isOpen){
        item.classList.add('open');
        var answer = item.querySelector('.faq-answer');
        answer.style.maxHeight = answer.scrollHeight + 'px';
        item.querySelector('.faq-icon').textContent = '\\u2212';
      }
    });
  });

  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(function(a){
    a.addEventListener('click', function(e){
      var target = document.querySelector(this.getAttribute('href'));
      if(target){
        e.preventDefault();
        target.scrollIntoView({ behavior:'smooth', block:'start' });
      }
    });
  });

  // Mobile nav toggle
  var toggle = document.querySelector('.mobile-nav-toggle');
  var nav = document.querySelector('.nav-links');
  if(toggle && nav){
    toggle.addEventListener('click', function(){
      nav.classList.toggle('open');
      this.setAttribute('aria-expanded', nav.classList.contains('open'));
    });
  }
})();
</script>`

// ---------------------------------------------------------------------------
// Nav bar renderer (glassmorphism fixed nav)
// ---------------------------------------------------------------------------

function renderNav(clientName: string, logoUrl?: string, ctaText?: string): string {
  return `
    <nav class="site-nav glass">
      <div class="nav-inner container">
        <div class="nav-brand">
          ${logoUrl ? `<img src="${esc(logoUrl)}" alt="${esc(clientName)}" class="nav-logo">` : ''}
          <span class="nav-name">${esc(clientName)}</span>
        </div>
        <div class="nav-links">
          <a href="#cta-form" class="btn btn-primary" style="padding:12px 28px;font-size:0.9rem">${esc(ctaText || 'Get Started')}</a>
        </div>
        <button class="mobile-nav-toggle" aria-label="Toggle navigation" aria-expanded="false">
          <span></span><span></span><span></span>
        </button>
      </div>
    </nav>`
}

const NAV_CSS = `
  .site-nav {
    position: fixed;
    top: 0; left: 0; right: 0;
    z-index: 1000;
    background: rgba(10,10,15,0.7);
    backdrop-filter: blur(24px) saturate(1.5);
    -webkit-backdrop-filter: blur(24px) saturate(1.5);
    border: none;
    border-bottom: 1px solid var(--border-subtle);
    border-radius: 0;
    padding: 0;
  }
  .nav-inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 72px;
  }
  .nav-brand {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .nav-logo {
    height: 36px;
    width: auto;
  }
  .nav-name {
    font-family: var(--heading-font);
    font-weight: 800;
    font-size: 1.15rem;
    letter-spacing: -0.01em;
  }
  .nav-links {
    display: flex;
    align-items: center;
    gap: 24px;
  }
  .mobile-nav-toggle {
    display: none;
    flex-direction: column;
    gap: 5px;
    background: none;
    border: none;
    cursor: pointer;
    padding: 8px;
  }
  .mobile-nav-toggle span {
    display: block;
    width: 24px;
    height: 2px;
    background: var(--brand-text);
    border-radius: 2px;
    transition: all var(--transition-fast);
  }
  @media (max-width: 768px) {
    .mobile-nav-toggle { display: flex; }
    .nav-links {
      position: absolute;
      top: 72px; left: 0; right: 0;
      background: rgba(10,10,15,0.95);
      backdrop-filter: blur(24px);
      padding: 20px 32px;
      border-bottom: 1px solid var(--border-subtle);
      display: none;
      flex-direction: column;
    }
    .nav-links.open { display: flex; }
    .nav-links .btn { width: 100%; }
  }
`

// ---------------------------------------------------------------------------
// Form renderer (by conversion type) — glassmorphism style
// ---------------------------------------------------------------------------

function renderForm(
  offer: Offer,
  sectionContent?: Record<string, unknown>,
  variant: 'default' | 'inline' | 'dark' = 'default',
): string {
  const ctaText = esc(
    (sectionContent && cf(sectionContent, 'cta', '')) ||
    offer.primary_cta ||
    'Get Started'
  )
  const headline = sectionContent ? esc(cf(sectionContent, 'headline', '')) : ''
  const subheadline = sectionContent ? esc(cf(sectionContent, 'subheadline', '')) : ''

  let fieldsHtml = ''
  switch (offer.conversion_type) {
    case 'phone_call':
      return `
        <div class="form-container glass-strong animate-on-scroll">
          ${headline ? `<h3 class="form-headline">${headline}</h3>` : ''}
          ${subheadline ? `<p class="form-sub">${subheadline}</p>` : ''}
          <a href="tel:" class="btn btn-primary btn-large btn-full btn-glow phone-cta" aria-label="Call now">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"></path></svg>
            ${ctaText || 'Call Now'}
          </a>
          <p class="form-trust-line">\u{1F512} No obligation. Free consultation.</p>
        </div>`
    case 'booking':
      fieldsHtml = `
        <div class="form-group"><label for="fname">Full Name</label><input type="text" id="fname" name="name" placeholder="John Smith" required></div>
        <div class="form-group"><label for="femail">Email Address</label><input type="email" id="femail" name="email" placeholder="john@company.com" required></div>
        <div class="form-group"><label for="fdate">Preferred Date</label><input type="date" id="fdate" name="date" required></div>`
      break
    case 'purchase':
      fieldsHtml = `
        <div class="form-group"><label for="femail">Email Address</label><input type="email" id="femail" name="email" placeholder="john@company.com" required></div>`
      break
    default: // lead_form
      fieldsHtml = `
        <div class="form-group"><label for="fname">Full Name</label><input type="text" id="fname" name="name" placeholder="John Smith" required></div>
        <div class="form-group"><label for="femail">Email Address</label><input type="email" id="femail" name="email" placeholder="john@company.com" required></div>
        <div class="form-group"><label for="fphone">Phone Number</label><input type="tel" id="fphone" name="phone" placeholder="(555) 123-4567"></div>`
  }

  // Override fields if the section content specifies custom fields
  if (sectionContent) {
    const customFields = cf<string[]>(sectionContent, 'fields', [])
    if (customFields.length > 0) {
      fieldsHtml = customFields
        .map((f, i) => {
          const id = `field_${i}`
          const type = f.toLowerCase().includes('email')
            ? 'email'
            : f.toLowerCase().includes('phone')
              ? 'tel'
              : f.toLowerCase().includes('date')
                ? 'date'
                : 'text'
          return `<div class="form-group"><label for="${id}">${esc(f)}</label><input type="${type}" id="${id}" name="${id}" placeholder="${esc(f)}" required></div>`
        })
        .join('\n')
    }
  }

  return `
    <form class="form-container glass-strong animate-on-scroll" onsubmit="event.preventDefault()">
      ${headline ? `<h3 class="form-headline">${headline}</h3>` : ''}
      ${subheadline ? `<p class="form-sub">${subheadline}</p>` : ''}
      ${fieldsHtml}
      <button type="submit" class="btn btn-primary btn-full btn-glow">${ctaText}</button>
      <p class="form-trust-line">\u{1F512} Your information is secure and will never be shared.</p>
    </form>`
}

const FORM_CSS = `
  .form-container {
    max-width: 440px;
    margin: 0 auto;
    padding: 40px 36px;
  }
  .form-headline {
    text-align: center;
    margin-bottom: 8px;
    font-size: 1.4rem;
  }
  .form-sub {
    text-align: center;
    margin-bottom: 24px;
    font-size: 0.95rem;
    color: var(--text-muted);
  }
  .form-trust-line {
    text-align: center;
    margin-top: 16px;
    font-size: 0.8rem;
    color: var(--text-dim);
  }
  @media (max-width: 480px) {
    .form-container { padding: 28px 20px; }
  }
`

// ---------------------------------------------------------------------------
// Section renderers — each template set overrides the render style
// ---------------------------------------------------------------------------

function sortSections(sections: PageSectionData[]): PageSectionData[] {
  return [...sections].sort((a, b) => a.order - b.order)
}

// =========================================================================
// TEMPLATE 1 — Clean Authority
// Sophisticated, minimal, lots of breathing room. Elegant and refined.
// =========================================================================

function cleanAuthorityCSS(): string {
  return `
    /* Clean Authority — dark luxe, generous whitespace, refined typography */

    /* Hero */
    .hero-ca {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 120px 0 100px;
      position: relative;
    }
    .hero-ca .container { position: relative; z-index: 2; }
    .hero-ca h1 {
      margin-bottom: 24px;
      max-width: 850px;
      margin-left: auto;
      margin-right: auto;
      font-weight: 800;
    }
    .hero-ca .sub {
      font-size: clamp(1.1rem,1.4vw,1.3rem);
      color: var(--text-muted);
      max-width: 600px;
      margin: 0 auto 44px;
      line-height: 1.7;
      font-weight: 300;
    }
    .hero-trust-strip {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 32px;
      margin-top: 52px;
      flex-wrap: wrap;
    }
    .hero-trust-item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.9rem;
      color: var(--text-muted);
      font-weight: 500;
    }
    .hero-trust-item .trust-check {
      width: 20px; height: 20px;
      border-radius: 50%;
      background: rgba(var(--primary-rgb), 0.15);
      display: flex; align-items: center; justify-content: center;
      color: var(--brand-primary);
      font-size: 0.65rem;
      font-weight: 700;
      flex-shrink: 0;
    }

    /* Light section breaks */
    .section-light {
      background: var(--surface-light);
      color: #1a1a2e;
    }
    .section-light h2, .section-light h3 { color: #1a1a2e; }
    .section-light p { color: #374151; }
    .section-light .text-muted { color: #6b7280; }

    /* Problem */
    .problem-ca { position: relative; }
    .problem-inner {
      display: grid;
      grid-template-columns: 4px 1fr;
      gap: 28px;
      max-width: 720px;
    }
    .problem-accent {
      background: linear-gradient(to bottom, var(--brand-primary), var(--brand-secondary));
      border-radius: 4px;
    }
    .problem-content h2 { margin-bottom: 24px; }
    .problem-content p {
      margin-bottom: 16px;
      line-height: 1.8;
      color: var(--text-muted);
    }

    /* Solution — glass cards */
    .solution-ca { text-align: center; }
    .solution-ca h2 { margin-bottom: 16px; }
    .solution-ca .lead {
      max-width: 640px;
      margin: 0 auto 56px;
      color: var(--text-muted);
      font-size: clamp(1rem,1.15vw,1.15rem);
      font-weight: 300;
    }
    .solution-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 24px;
    }
    .solution-card {
      padding: 40px 28px;
      border-radius: var(--radius-lg);
      background: rgba(255,255,255,0.03);
      border: 1px solid var(--border-subtle);
      transition: all var(--transition);
      position: relative;
      overflow: hidden;
    }
    .solution-card::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 3px;
      background: linear-gradient(90deg, var(--brand-primary), var(--brand-secondary));
      opacity: 0;
      transition: opacity var(--transition);
    }
    .solution-card:hover {
      background: rgba(255,255,255,0.06);
      border-color: rgba(var(--primary-rgb), 0.2);
      transform: translateY(-6px);
      box-shadow: 0 20px 40px rgba(0,0,0,0.3), 0 0 30px rgba(var(--primary-rgb), 0.08);
    }
    .solution-card:hover::before { opacity: 1; }
    .solution-card .step-indicator {
      width: 48px; height: 48px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--brand-primary), var(--brand-secondary));
      display: flex; align-items: center; justify-content: center;
      font-weight: 800; font-size: 1.1rem;
      color: #fff;
      margin: 0 auto 20px;
      box-shadow: 0 4px 15px rgba(var(--primary-rgb), 0.3);
    }
    .solution-card h3 { margin-bottom: 12px; font-size: 1.15rem; }
    .solution-card p { font-size: 0.95rem; color: var(--text-muted); line-height: 1.7; }

    /* Benefits */
    .benefits-ca h2 { text-align: center; margin-bottom: 56px; }
    .benefits-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 24px;
    }
    .benefit-card {
      padding: 32px 28px;
      border-radius: var(--radius-md);
      border: 1px solid var(--border-subtle);
      background: rgba(255,255,255,0.02);
      transition: all var(--transition);
      position: relative;
    }
    .benefit-card::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 3px;
      background: linear-gradient(90deg, var(--brand-primary), var(--brand-secondary));
      border-radius: 3px 3px 0 0;
    }
    .benefit-card:hover {
      border-color: rgba(var(--primary-rgb), 0.2);
      background: rgba(255,255,255,0.04);
      transform: translateY(-4px);
      box-shadow: var(--shadow-lg);
    }
    .benefit-check-icon {
      width: 32px; height: 32px;
      border-radius: 50%;
      background: rgba(var(--primary-rgb), 0.12);
      display: flex; align-items: center; justify-content: center;
      color: var(--brand-primary);
      font-weight: 700;
      font-size: 0.85rem;
      margin-bottom: 16px;
    }
    .benefit-card p { color: var(--text-muted); line-height: 1.7; }

    /* Proof / Testimonials */
    .proof-ca h2 { text-align: center; margin-bottom: 56px; }
    .proof-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 24px;
    }
    .testimonial-card {
      padding: 36px 32px;
      border-radius: var(--radius-lg);
      background: rgba(255,255,255,0.04);
      backdrop-filter: blur(10px);
      border: 1px solid var(--border-subtle);
      position: relative;
      transition: all var(--transition);
    }
    .testimonial-card:hover {
      background: rgba(255,255,255,0.06);
      transform: translateY(-4px);
      box-shadow: var(--shadow-lg);
    }
    .testimonial-quote-mark {
      font-size: 4rem;
      font-family: Georgia, serif;
      background: linear-gradient(135deg, var(--brand-primary), var(--brand-secondary));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      line-height: 1;
      margin-bottom: 8px;
      display: block;
    }
    .testimonial-card .text {
      font-style: italic;
      margin-bottom: 20px;
      color: var(--text-muted);
      line-height: 1.7;
      font-size: 1.02rem;
    }
    .testimonial-stars {
      color: var(--brand-accent);
      font-size: 1rem;
      letter-spacing: 3px;
      margin-bottom: 16px;
    }
    .testimonial-author {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .testimonial-avatar {
      width: 44px; height: 44px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--brand-primary), var(--brand-secondary));
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 1rem; color: #fff;
      flex-shrink: 0;
    }
    .testimonial-author-name { font-weight: 600; font-size: 0.95rem; }
    .testimonial-author-role { font-size: 0.8rem; color: var(--text-dim); }

    /* FAQ */
    .faq-ca h2 { text-align: center; margin-bottom: 48px; }
    .faq-list { max-width: 720px; margin: 0 auto; }
    .faq-item {
      border-radius: var(--radius-md);
      margin-bottom: 8px;
      background: rgba(255,255,255,0.03);
      border: 1px solid var(--border-subtle);
      overflow: hidden;
      transition: all var(--transition);
    }
    .faq-item:hover { border-color: rgba(var(--primary-rgb), 0.2); }
    .faq-item.open {
      border-color: rgba(var(--primary-rgb), 0.3);
      background: rgba(255,255,255,0.05);
    }
    .faq-question {
      width: 100%; background: none; border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: space-between;
      padding: 22px 28px;
      font-family: var(--heading-font);
      font-size: clamp(0.95rem,1.05vw,1.05rem);
      font-weight: 600;
      color: var(--brand-text);
      text-align: left;
      transition: color var(--transition-fast);
    }
    .faq-question:hover { color: var(--brand-primary); }
    .faq-question:focus-visible { outline: 2px solid var(--brand-primary); outline-offset: -2px; }
    .faq-icon {
      font-size: 1.3rem;
      flex-shrink: 0;
      margin-left: 16px;
      transition: transform var(--transition);
      color: var(--brand-primary);
      font-weight: 300;
    }
    .faq-answer { max-height: 0; overflow: hidden; transition: max-height 0.4s var(--ease-out-expo); }
    .faq-answer-inner {
      padding: 0 28px 24px;
      color: var(--text-muted);
      line-height: 1.8;
      font-size: 0.98rem;
    }

    /* Final CTA */
    .final-cta-ca {
      text-align: center;
      padding: 120px 0;
      position: relative;
    }
    .final-cta-ca h2 { margin-bottom: 16px; }
    .final-cta-ca .sub {
      max-width: 560px;
      margin: 0 auto 40px;
      color: var(--text-muted);
      font-size: clamp(1rem,1.15vw,1.15rem);
      font-weight: 300;
    }

    /* Trust strip */
    .trust-strip {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 40px;
      flex-wrap: wrap;
      padding: 20px 0;
    }
    .trust-strip-item {
      font-size: 0.9rem;
      font-weight: 500;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 20px;
      border-radius: 100px;
      background: rgba(255,255,255,0.03);
      border: 1px solid var(--border-subtle);
    }

    /* Urgency bar */
    .urgency-bar {
      background: linear-gradient(90deg, var(--brand-primary), var(--brand-secondary), var(--brand-accent));
      background-size: 200% 200%;
      animation: gradient-shift 4s ease infinite;
      color: #fff;
      text-align: center;
      padding: 16px 24px;
      font-weight: 700;
      font-size: 0.95rem;
      letter-spacing: 0.03em;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
    }
    .urgency-dot {
      width: 8px; height: 8px;
      border-radius: 50%;
      background: #fff;
      animation: pulse-dot 2s ease-in-out infinite;
    }

    /* Comparison */
    .comparison-section h2 { text-align: center; margin-bottom: 48px; }
    .comparison-table-wrapper {
      max-width: 720px;
      margin: 0 auto;
      border-radius: var(--radius-lg);
      overflow: hidden;
      border: 1px solid var(--border-subtle);
      background: rgba(255,255,255,0.02);
    }
    .comparison-table {
      width: 100%;
      border-collapse: collapse;
    }
    .comparison-table th {
      padding: 18px 24px;
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text-dim);
      font-weight: 700;
      border-bottom: 1px solid var(--border-subtle);
      background: rgba(255,255,255,0.03);
    }
    .comparison-table th.client-col {
      color: var(--brand-primary);
    }
    .comparison-table td {
      padding: 16px 24px;
      text-align: center;
      border-bottom: 1px solid var(--border-subtle);
    }
    .comparison-table tr:last-child td { border-bottom: none; }
    .comparison-table td:first-child {
      text-align: left;
      font-weight: 500;
      color: var(--text-muted);
    }
    .comparison-table tr:hover td { background: rgba(255,255,255,0.02); }
    .check-yes {
      color: var(--brand-primary);
      font-weight: 700;
      font-size: 1.2rem;
    }
    .check-no {
      color: #ef4444;
      font-weight: 700;
      font-size: 1.2rem;
      opacity: 0.5;
    }

    /* Process steps */
    .process-section h2 { text-align: center; margin-bottom: 56px; }
    .process-steps {
      display: flex;
      flex-direction: column;
      gap: 0;
      max-width: 640px;
      margin: 0 auto;
      position: relative;
    }
    .process-steps::before {
      content: '';
      position: absolute;
      left: 27px;
      top: 28px;
      bottom: 28px;
      width: 2px;
      background: linear-gradient(to bottom, var(--brand-primary), var(--brand-secondary), var(--brand-accent));
      border-radius: 2px;
    }
    .step-item {
      display: flex;
      gap: 24px;
      align-items: flex-start;
      position: relative;
      padding: 20px 0;
    }
    .step-num {
      flex-shrink: 0;
      width: 56px; height: 56px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--brand-primary), var(--brand-secondary));
      color: #fff;
      display: flex; align-items: center; justify-content: center;
      font-weight: 800; font-size: 1.1rem;
      position: relative; z-index: 1;
      box-shadow: 0 4px 15px rgba(var(--primary-rgb), 0.3), 0 0 0 6px var(--brand-bg);
    }
    .step-body { padding-top: 8px; }
    .step-body h3 { font-size: 1.15rem; margin-bottom: 8px; }
    .step-body p { font-size: 0.95rem; color: var(--text-muted); line-height: 1.7; }

    /* Responsive */
    @media (max-width: 1024px) {
      .hero-ca { padding: 100px 0 80px; min-height: auto; }
    }
    @media (max-width: 768px) {
      .hero-ca { padding: 100px 0 64px; }
      .solution-grid, .benefits-grid { grid-template-columns: 1fr; }
      .proof-grid { grid-template-columns: 1fr; }
      .hero-trust-strip { gap: 16px; }
      .trust-strip { gap: 12px; }
      .comparison-table th, .comparison-table td { padding: 12px 16px; font-size: 0.88rem; }
    }
    @media (max-width: 480px) {
      .hero-ca { padding: 88px 0 48px; }
      .final-cta-ca { padding: 80px 0; }
      .hero-trust-strip { flex-direction: column; gap: 10px; }
    }
  `
}

function renderCleanAuthority(
  sections: PageSectionData[],
  _brandKit: BrandKit,
  offer: Offer,
  _clientName: string,
): string {
  const sorted = sortSections(sections)
  let html = ''
  let sectionIdx = 0

  for (const section of sorted) {
    const c = section.content
    const isEven = sectionIdx % 2 === 1
    switch (section.type) {
      case 'hero': {
        const headline = esc(cf(c, 'headline', ''))
        const subheadline = esc(cf(c, 'subheadline', ''))
        const cta = esc(cf(c, 'cta', offer.primary_cta || 'Get Started'))
        const trustItems = cf<string[]>(c, 'trust_items', [])
        html += `
          <section class="lp-section hero-ca gradient-mesh noise-overlay" id="s-${section.id}">
            <div class="orb orb-1"></div>
            <div class="orb orb-2"></div>
            <div class="orb orb-3"></div>
            <div class="container text-center" style="position:relative;z-index:2">
              <div class="animate-on-scroll">
                <span class="eyebrow">${esc(_clientName)}</span>
                <h1><span class="gradient-text">${headline}</span></h1>
                <p class="sub">${subheadline}</p>
                <a href="#cta-form" class="btn btn-primary btn-large btn-glow">${cta}</a>
              </div>
              ${trustItems.length ? `
                <div class="hero-trust-strip animate-on-scroll animate-delay-2">
                  ${trustItems.map(t => `<div class="hero-trust-item"><span class="trust-check">\u2713</span><span>${esc(t)}</span></div>`).join('')}
                </div>` : ''}
            </div>
          </section>`
        sectionIdx++
        break
      }
      case 'problem': {
        const headline = esc(cf(c, 'headline', ''))
        const content = esc(cf(c, 'content', ''))
        html += `
          <section class="lp-section problem-ca noise-overlay" id="s-${section.id}">
            <div class="container">
              <div class="animate-on-scroll">
                ${headline ? `<div class="eyebrow">The Problem</div>` : ''}
                <div class="problem-inner">
                  <div class="problem-accent"></div>
                  <div class="problem-content">
                    ${headline ? `<h2>${headline}</h2>` : ''}
                    ${content.split('\n').filter(Boolean).map(p => `<p>${p}</p>`).join('')}
                  </div>
                </div>
              </div>
            </div>
          </section>`
        sectionIdx++
        break
      }
      case 'solution': {
        const headline = esc(cf(c, 'headline', ''))
        const content = esc(cf(c, 'content', ''))
        const steps = cf<{ title: string; description: string }[]>(c, 'steps', [])
        html += `
          <section class="lp-section solution-ca noise-overlay" id="s-${section.id}" style="background:var(--surface-1)">
            <div class="container">
              <div class="animate-on-scroll">
                <span class="eyebrow">How It Works</span>
                ${headline ? `<h2>${headline}</h2>` : ''}
                ${content ? `<p class="lead">${content}</p>` : ''}
              </div>
              ${steps.length ? `
                <div class="solution-grid">
                  ${steps.map((s, i) => `
                    <div class="solution-card animate-on-scroll animate-delay-${Math.min(i + 1, 5)}">
                      <div class="step-indicator">${i + 1}</div>
                      <h3>${esc(s.title)}</h3>
                      <p>${esc(s.description)}</p>
                    </div>
                  `).join('')}
                </div>` : ''}
            </div>
          </section>`
        sectionIdx++
        break
      }
      case 'benefits': {
        const headline = esc(cf(c, 'headline', ''))
        const items = cf<string[]>(c, 'items', [])
        html += `
          <section class="lp-section benefits-ca" id="s-${section.id}">
            <div class="container">
              <div class="animate-on-scroll">
                <span class="eyebrow" style="display:block;text-align:center">Benefits</span>
                ${headline ? `<h2>${headline}</h2>` : ''}
              </div>
              <div class="benefits-grid">
                ${items.map((item, i) => `
                  <div class="benefit-card animate-on-scroll animate-delay-${Math.min(i + 1, 5)}">
                    <div class="benefit-check-icon">\u2713</div>
                    <p>${esc(item)}</p>
                  </div>
                `).join('')}
              </div>
            </div>
          </section>`
        sectionIdx++
        break
      }
      case 'proof': {
        const headline = esc(cf(c, 'headline', ''))
        const items = cf<string[]>(c, 'items', [])
        html += `
          <section class="lp-section proof-ca noise-overlay" id="s-${section.id}" style="background:var(--surface-1)">
            <div class="container">
              <div class="animate-on-scroll">
                <span class="eyebrow" style="display:block;text-align:center">Testimonials</span>
                ${headline ? `<h2>${headline}</h2>` : ''}
              </div>
              <div class="proof-grid">
                ${items.map((item, i) => {
                  const initials = item.length > 0 ? item.charAt(0).toUpperCase() : '?'
                  return `
                    <div class="testimonial-card animate-on-scroll animate-delay-${Math.min(i + 1, 5)}">
                      <span class="testimonial-quote-mark">\u201C</span>
                      <div class="testimonial-stars">\u2605\u2605\u2605\u2605\u2605</div>
                      <p class="text">${esc(item)}</p>
                      <div class="testimonial-author">
                        <div class="testimonial-avatar">${initials}</div>
                        <div>
                          <div class="testimonial-author-name">Verified Customer</div>
                          <div class="testimonial-author-role">Customer</div>
                        </div>
                      </div>
                    </div>`
                }).join('')}
              </div>
            </div>
          </section>`
        sectionIdx++
        break
      }
      case 'faq': {
        const headline = esc(cf(c, 'headline', 'Frequently Asked Questions'))
        const items = cf<{ question: string; answer: string }[]>(c, 'items', [])
        html += `
          <section class="lp-section faq-ca" id="s-${section.id}">
            <div class="container">
              <div class="animate-on-scroll">
                <span class="eyebrow" style="display:block;text-align:center">FAQ</span>
                <h2>${headline}</h2>
              </div>
              <div class="faq-list animate-on-scroll animate-delay-1" role="list">
                ${items.map(item => `
                  <div class="faq-item" role="listitem">
                    <button class="faq-question" aria-expanded="false">
                      <span>${esc(item.question)}</span>
                      <span class="faq-icon" aria-hidden="true">+</span>
                    </button>
                    <div class="faq-answer" role="region">
                      <div class="faq-answer-inner">${esc(item.answer)}</div>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          </section>`
        sectionIdx++
        break
      }
      case 'final_cta': {
        const headline = esc(cf(c, 'headline', ''))
        const subheadline = esc(cf(c, 'subheadline', ''))
        const cta = esc(cf(c, 'cta', offer.primary_cta || 'Get Started'))
        html += `
          <section class="lp-section final-cta-ca gradient-mesh noise-overlay" id="cta-form">
            <div class="orb orb-1" style="width:300px;height:300px"></div>
            <div class="orb orb-2" style="width:250px;height:250px"></div>
            <div class="container text-center" style="position:relative;z-index:2">
              <div class="animate-on-scroll">
                <h2 class="gradient-text">${headline}</h2>
                ${subheadline ? `<p class="sub">${subheadline}</p>` : ''}
                ${offer.conversion_type === 'lead_form' || offer.conversion_type === 'booking'
                  ? renderForm(offer)
                  : offer.conversion_type === 'phone_call'
                    ? `<a href="tel:" class="btn btn-primary btn-large btn-glow"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg> ${cta}</a>`
                    : `<a href="#cta-form" class="btn btn-primary btn-large btn-glow">${cta}</a>`
                }
              </div>
            </div>
          </section>`
        sectionIdx++
        break
      }
      case 'form': {
        html += `
          <section class="lp-section noise-overlay" id="cta-form" style="background:var(--surface-1)">
            <div class="container">${renderForm(offer, c)}</div>
          </section>`
        sectionIdx++
        break
      }
      case 'urgency_bar': {
        const text = esc(cf(c, 'text', ''))
        html += `<div class="urgency-bar" role="alert"><span class="urgency-dot"></span> ${text}</div>`
        break
      }
      case 'trust_strip': {
        const items = cf<string[]>(c, 'items', [])
        html += `
          <div class="lp-section" style="padding:40px 0;background:var(--surface-1)">
            <div class="container">
              <div class="trust-strip animate-on-scroll">
                ${items.map(i => `<span class="trust-strip-item">${esc(i)}</span>`).join('')}
              </div>
            </div>
          </div>`
        break
      }
      case 'comparison': {
        const headline = esc(cf(c, 'headline', ''))
        const clientLabel = esc(cf(c, 'client_name', _clientName))
        const compItems = cf<{ feature: string; client: boolean; competitor: boolean }[]>(c, 'items', [])
        html += `
          <section class="lp-section comparison-section" id="s-${section.id}" style="background:var(--surface-1)">
            <div class="container">
              <div class="animate-on-scroll">
                <span class="eyebrow" style="display:block;text-align:center">Compare</span>
                ${headline ? `<h2 class="text-center">${headline}</h2>` : ''}
              </div>
              <div class="comparison-table-wrapper animate-on-scroll animate-delay-1">
                <table class="comparison-table">
                  <thead><tr><th></th><th class="client-col">${clientLabel}</th><th>Others</th></tr></thead>
                  <tbody>
                    ${compItems.map(item => `
                      <tr>
                        <td>${esc(item.feature)}</td>
                        <td><span class="${item.client ? 'check-yes' : 'check-no'}">${item.client ? '\u2713' : '\u2717'}</span></td>
                        <td><span class="${item.competitor ? 'check-yes' : 'check-no'}">${item.competitor ? '\u2713' : '\u2717'}</span></td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          </section>`
        sectionIdx++
        break
      }
      case 'process_steps': {
        const headline = esc(cf(c, 'headline', ''))
        const steps = cf<{ number: number; title: string; description: string }[]>(c, 'steps', [])
        html += `
          <section class="lp-section process-section" id="s-${section.id}">
            <div class="container">
              <div class="animate-on-scroll">
                <span class="eyebrow" style="display:block;text-align:center">Process</span>
                ${headline ? `<h2 class="text-center">${headline}</h2>` : ''}
              </div>
              <div class="process-steps animate-on-scroll animate-delay-1">
                ${steps.map((s, i) => `
                  <div class="step-item animate-on-scroll animate-delay-${Math.min(i + 1, 5)}">
                    <div class="step-num">${s.number}</div>
                    <div class="step-body"><h3>${esc(s.title)}</h3><p>${esc(s.description)}</p></div>
                  </div>
                `).join('')}
              </div>
            </div>
          </section>`
        sectionIdx++
        break
      }
    }
  }
  return html
}

// =========================================================================
// TEMPLATE 2 — Bold Conversion
// High contrast, energetic, aggressive CTAs, urgency-driven
// =========================================================================

function boldConversionCSS(): string {
  return `
    /* Bold Conversion — high contrast, energetic, gradient-heavy */

    /* Hero */
    .hero-bc {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 120px 0 80px;
      background:
        radial-gradient(ellipse at 30% 0%, rgba(var(--primary-rgb), 0.2) 0%, transparent 50%),
        radial-gradient(ellipse at 70% 100%, rgba(var(--secondary-rgb), 0.15) 0%, transparent 50%),
        radial-gradient(ellipse at 50% 50%, rgba(var(--accent-rgb), 0.05) 0%, transparent 70%),
        linear-gradient(to bottom, #0a0a12, #0f0f1a);
      position: relative;
    }
    .hero-bc h1 {
      font-size: clamp(2.8rem, 7vw, 5rem);
      font-weight: 900;
      margin-bottom: 24px;
      max-width: 900px;
      margin-left: auto;
      margin-right: auto;
      letter-spacing: -0.03em;
    }
    .hero-bc .sub {
      font-size: clamp(1.1rem,1.4vw,1.35rem);
      color: var(--text-muted);
      max-width: 640px;
      margin: 0 auto 40px;
      font-weight: 300;
    }
    .hero-bc .btn-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 16px;
      flex-wrap: wrap;
      margin-bottom: 16px;
    }
    .hero-urgency-line {
      font-size: 0.95rem;
      font-weight: 600;
      color: var(--brand-accent);
      margin-top: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    .hero-urgency-line .urgency-dot {
      width: 6px; height: 6px;
    }

    /* Urgency bar — animated gradient */
    .urgency-bar-bc {
      background: linear-gradient(90deg, var(--brand-accent), #f97316, var(--brand-primary), var(--brand-accent));
      background-size: 300% 100%;
      animation: gradient-shift 4s ease infinite;
      color: #fff;
      text-align: center;
      padding: 18px 24px;
      font-weight: 800;
      font-size: clamp(0.88rem,1vw,1rem);
      letter-spacing: 0.06em;
      text-transform: uppercase;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
    }

    /* Trust strip with stats */
    .trust-strip-bc {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 48px;
      flex-wrap: wrap;
      padding: 48px 0;
    }
    .trust-stat {
      text-align: center;
      padding: 24px;
      border-radius: var(--radius-md);
      background: rgba(255,255,255,0.03);
      border: 1px solid var(--border-subtle);
      min-width: 140px;
    }
    .trust-stat .num {
      font-size: clamp(2rem, 3.5vw, 3rem);
      font-weight: 900;
      font-family: var(--heading-font);
      display: block;
      margin-bottom: 4px;
    }
    .trust-stat .lbl {
      font-size: 0.8rem;
      color: var(--text-dim);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      font-weight: 600;
    }

    /* Problem — split layout */
    .problem-bc-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 64px;
      align-items: center;
    }
    .problem-bc-grid h2 { margin-bottom: 24px; }
    .problem-bc-grid p { margin-bottom: 16px; color: var(--text-muted); line-height: 1.8; }
    .problem-visual {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 280px;
      border-radius: var(--radius-xl);
      background:
        radial-gradient(circle at center, rgba(var(--accent-rgb), 0.1) 0%, transparent 70%),
        rgba(255,255,255,0.02);
      border: 1px solid var(--border-subtle);
      font-size: 8rem;
      opacity: 0.15;
    }

    /* Solution band — gradient bg */
    .solution-bc {
      background: linear-gradient(135deg, var(--brand-primary), var(--brand-secondary));
      color: #fff;
      text-align: center;
    }
    .solution-bc h2, .solution-bc h3, .solution-bc p { color: #fff; }
    .solution-bc .lead { max-width: 640px; margin: 0 auto 48px; opacity: 0.9; }
    .solution-bc-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 24px;
      margin-top: 40px;
    }
    .solution-bc-card {
      padding: 32px 24px;
      text-align: center;
      border-radius: var(--radius-lg);
      background: rgba(255,255,255,0.1);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255,255,255,0.15);
      transition: all var(--transition);
    }
    .solution-bc-card:hover {
      background: rgba(255,255,255,0.15);
      transform: translateY(-6px);
    }
    .solution-bc-card .num {
      width: 52px; height: 52px;
      border-radius: 50%;
      background: rgba(255,255,255,0.2);
      display: flex; align-items: center; justify-content: center;
      font-weight: 800; font-size: 1.2rem;
      margin: 0 auto 16px;
    }
    .solution-bc-card h3 { margin-bottom: 10px; }
    .solution-bc-card p { font-size: 0.95rem; opacity: 0.85; }

    /* Benefits — bold check list */
    .benefits-bc h2 { text-align: center; margin-bottom: 56px; }
    .benefits-bc-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
      max-width: 800px;
      margin: 0 auto;
    }
    .benefit-bc-row {
      display: flex;
      align-items: flex-start;
      gap: 16px;
      padding: 24px;
      border-radius: var(--radius-md);
      background: rgba(255,255,255,0.03);
      border: 1px solid var(--border-subtle);
      transition: all var(--transition);
    }
    .benefit-bc-row:hover {
      background: rgba(255,255,255,0.06);
      border-color: rgba(var(--primary-rgb), 0.2);
      transform: translateX(4px);
    }
    .benefit-bc-check {
      width: 28px; height: 28px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--brand-primary), var(--brand-secondary));
      display: flex; align-items: center; justify-content: center;
      color: #fff;
      font-size: 0.75rem;
      font-weight: 700;
      flex-shrink: 0;
      margin-top: 2px;
    }
    .benefit-bc-text { color: var(--text-muted); font-size: 1.02rem; line-height: 1.6; }

    /* Proof */
    .proof-bc h2 { text-align: center; margin-bottom: 56px; }
    .proof-bc-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 24px;
    }
    .testimonial-bc {
      padding: 36px 32px;
      border-radius: var(--radius-lg);
      background: rgba(255,255,255,0.04);
      border: 1px solid var(--border-subtle);
      transition: all var(--transition);
      position: relative;
      overflow: hidden;
    }
    .testimonial-bc::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 3px;
      background: linear-gradient(90deg, var(--brand-accent), var(--brand-primary));
    }
    .testimonial-bc:hover {
      background: rgba(255,255,255,0.06);
      transform: translateY(-4px);
      box-shadow: var(--shadow-lg);
    }
    .testimonial-bc .stars {
      color: var(--brand-accent);
      font-size: 1.1rem;
      letter-spacing: 3px;
      margin-bottom: 16px;
    }
    .testimonial-bc .text {
      margin-bottom: 24px;
      color: var(--text-muted);
      font-style: italic;
      line-height: 1.7;
    }
    .testimonial-bc .author-row {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .testimonial-bc .avatar-circle {
      width: 48px; height: 48px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--brand-primary), var(--brand-accent));
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; color: #fff; font-size: 1.1rem;
    }
    .testimonial-bc .author-name { font-weight: 600; font-size: 0.95rem; }
    .testimonial-bc .author-role { font-size: 0.8rem; color: var(--text-dim); }

    /* FAQ */
    .faq-bc h2 { text-align: center; margin-bottom: 48px; }
    .faq-bc .faq-list { max-width: 720px; margin: 0 auto; }
    .faq-bc .faq-item {
      margin-bottom: 8px;
      border-radius: var(--radius-md);
      overflow: hidden;
      border: 1px solid var(--border-subtle);
      background: rgba(255,255,255,0.03);
    }
    .faq-bc .faq-question {
      padding: 20px 28px;
      background: none;
      border: none;
    }
    .faq-bc .faq-item.open {
      background: rgba(var(--primary-rgb), 0.08);
      border-color: rgba(var(--primary-rgb), 0.3);
    }
    .faq-bc .faq-item.open .faq-question { color: var(--brand-primary); }
    .faq-bc .faq-answer-inner { padding: 0 28px 24px; }

    /* Final CTA */
    .final-cta-bc {
      text-align: center;
      padding: 120px 0;
      background: linear-gradient(135deg, rgba(var(--primary-rgb), 0.15), rgba(var(--secondary-rgb), 0.1));
      position: relative;
    }
    .final-cta-bc h2 { margin-bottom: 16px; }
    .final-cta-bc .sub {
      max-width: 560px;
      margin: 0 auto 36px;
      color: var(--text-muted);
      font-weight: 300;
    }
    .countdown-row {
      display: inline-flex;
      gap: 8px;
      margin-bottom: 40px;
    }
    .countdown-unit {
      background: rgba(255,255,255,0.06);
      border: 1px solid var(--border-glass);
      padding: 16px 20px;
      border-radius: var(--radius-md);
      min-width: 60px;
      text-align: center;
      font-family: var(--heading-font);
      font-weight: 800;
      font-size: 1.6rem;
    }
    .countdown-sep {
      display: flex;
      align-items: center;
      font-size: 1.4rem;
      font-weight: 700;
      color: var(--text-dim);
    }

    /* Comparison, Process, Trust — inherit from base with template overrides */
    .comparison-section-bc h2 { text-align: center; margin-bottom: 48px; }
    .process-bc-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 24px;
      margin-top: 48px;
    }
    .step-bc-card {
      text-align: center;
      padding: 36px 24px;
      border-radius: var(--radius-lg);
      background: rgba(255,255,255,0.03);
      border: 1px solid var(--border-subtle);
      transition: all var(--transition);
    }
    .step-bc-card:hover {
      background: rgba(255,255,255,0.06);
      transform: translateY(-6px);
      box-shadow: var(--shadow-lg);
    }
    .step-bc-card .num {
      width: 56px; height: 56px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--brand-primary), var(--brand-secondary));
      color: #fff;
      display: flex; align-items: center; justify-content: center;
      font-weight: 800; font-size: 1.2rem;
      margin: 0 auto 20px;
      box-shadow: 0 4px 15px rgba(var(--primary-rgb), 0.3);
    }
    .step-bc-card h3 { margin-bottom: 10px; }
    .step-bc-card p { font-size: 0.95rem; color: var(--text-muted); }

    /* Responsive */
    @media (max-width: 1024px) {
      .hero-bc { min-height: auto; padding: 100px 0 80px; }
    }
    @media (max-width: 768px) {
      .hero-bc { padding: 100px 0 64px; }
      .problem-bc-grid { grid-template-columns: 1fr; gap: 32px; }
      .problem-visual { display: none; }
      .solution-bc-grid, .process-bc-grid { grid-template-columns: 1fr; }
      .benefits-bc-grid { grid-template-columns: 1fr; }
      .proof-bc-grid { grid-template-columns: 1fr; }
      .trust-strip-bc { gap: 16px; }
    }
    @media (max-width: 480px) {
      .hero-bc { padding: 88px 0 48px; }
      .final-cta-bc { padding: 80px 0; }
      .countdown-unit { padding: 12px 14px; font-size: 1.2rem; min-width: 48px; }
    }
  `
}

function renderBoldConversion(
  sections: PageSectionData[],
  _brandKit: BrandKit,
  offer: Offer,
  clientName: string,
): string {
  const sorted = sortSections(sections)
  let html = ''

  for (const section of sorted) {
    const c = section.content
    switch (section.type) {
      case 'hero': {
        const headline = esc(cf(c, 'headline', ''))
        const subheadline = esc(cf(c, 'subheadline', ''))
        const cta = esc(cf(c, 'cta', offer.primary_cta || 'Get Started'))
        html += `
          <section class="lp-section hero-bc noise-overlay" id="s-${section.id}">
            <div class="orb orb-1"></div>
            <div class="orb orb-2"></div>
            <div class="orb orb-3"></div>
            <div class="container text-center" style="position:relative;z-index:2">
              <div class="animate-on-scroll">
                <h1><span class="gradient-text">${headline}</span></h1>
                <p class="sub">${subheadline}</p>
                <div class="btn-row">
                  <a href="#cta-form" class="btn btn-primary btn-large btn-glow">${cta}</a>
                  <a href="#cta-form" class="btn btn-secondary btn-large">Learn More</a>
                </div>
                <div class="hero-urgency-line animate-on-scroll animate-delay-2">
                  <span class="urgency-dot"></span> Limited availability &mdash; Act now
                </div>
              </div>
            </div>
          </section>`
        break
      }
      case 'urgency_bar': {
        const text = esc(cf(c, 'text', ''))
        html += `<div class="urgency-bar-bc" role="alert"><span class="urgency-dot"></span> ${text}</div>`
        break
      }
      case 'trust_strip': {
        const items = cf<string[]>(c, 'items', [])
        html += `
          <div class="lp-section" style="padding:56px 0;background:var(--surface-1)">
            <div class="container">
              <div class="trust-strip-bc animate-on-scroll">
                ${items.map((item, i) => `<div class="trust-stat animate-on-scroll animate-delay-${Math.min(i + 1, 5)}"><span class="num gradient-text">${esc(item)}</span></div>`).join('')}
              </div>
            </div>
          </div>`
        break
      }
      case 'problem': {
        const headline = esc(cf(c, 'headline', ''))
        const content = esc(cf(c, 'content', ''))
        html += `
          <section class="lp-section noise-overlay" id="s-${section.id}">
            <div class="container">
              <div class="problem-bc-grid">
                <div class="animate-on-scroll">
                  <span class="eyebrow">The Problem</span>
                  ${headline ? `<h2>${headline}</h2>` : ''}
                  ${content.split('\n').filter(Boolean).map(p => `<p>${p}</p>`).join('')}
                </div>
                <div class="problem-visual animate-on-scroll animate-delay-2" aria-hidden="true">\u26A0</div>
              </div>
            </div>
          </section>`
        break
      }
      case 'solution': {
        const headline = esc(cf(c, 'headline', ''))
        const content = esc(cf(c, 'content', ''))
        const steps = cf<{ title: string; description: string }[]>(c, 'steps', [])
        html += `
          <section class="lp-section solution-bc" id="s-${section.id}">
            <div class="container text-center">
              <div class="animate-on-scroll">
                <span class="eyebrow" style="background:rgba(255,255,255,0.15);border-color:rgba(255,255,255,0.2);color:#fff">The Solution</span>
                <h2>${headline}</h2>
                ${content ? `<p class="lead">${content}</p>` : ''}
              </div>
              ${steps.length ? `
                <div class="solution-bc-grid">
                  ${steps.map((s, i) => `
                    <div class="solution-bc-card animate-on-scroll animate-delay-${Math.min(i + 1, 5)}">
                      <div class="num">${i + 1}</div>
                      <h3>${esc(s.title)}</h3>
                      <p>${esc(s.description)}</p>
                    </div>
                  `).join('')}
                </div>` : ''}
            </div>
          </section>`
        break
      }
      case 'benefits': {
        const headline = esc(cf(c, 'headline', ''))
        const items = cf<string[]>(c, 'items', [])
        html += `
          <section class="lp-section benefits-bc noise-overlay" id="s-${section.id}" style="background:var(--surface-1)">
            <div class="container">
              <div class="animate-on-scroll">
                <span class="eyebrow" style="display:block;text-align:center">Benefits</span>
                ${headline ? `<h2>${headline}</h2>` : ''}
              </div>
              <div class="benefits-bc-grid">
                ${items.map((item, i) => `
                  <div class="benefit-bc-row animate-on-scroll animate-delay-${Math.min(i + 1, 5)}">
                    <span class="benefit-bc-check">\u2713</span>
                    <span class="benefit-bc-text">${esc(item)}</span>
                  </div>
                `).join('')}
              </div>
            </div>
          </section>`
        break
      }
      case 'proof': {
        const headline = esc(cf(c, 'headline', ''))
        const items = cf<string[]>(c, 'items', [])
        html += `
          <section class="lp-section proof-bc" id="s-${section.id}">
            <div class="container">
              <div class="animate-on-scroll">
                <span class="eyebrow" style="display:block;text-align:center">Proof</span>
                ${headline ? `<h2>${headline}</h2>` : ''}
              </div>
              <div class="proof-bc-grid">
                ${items.map((item, i) => {
                  const initials = item.length > 0 ? item.charAt(0).toUpperCase() : '?'
                  return `
                    <div class="testimonial-bc animate-on-scroll animate-delay-${Math.min(i + 1, 5)}">
                      <div class="stars">\u2605\u2605\u2605\u2605\u2605</div>
                      <p class="text">${esc(item)}</p>
                      <div class="author-row">
                        <div class="avatar-circle">${initials}</div>
                        <div>
                          <div class="author-name">Verified Customer</div>
                          <div class="author-role">Customer #${1000 + i}</div>
                        </div>
                      </div>
                    </div>`
                }).join('')}
              </div>
            </div>
          </section>`
        break
      }
      case 'faq': {
        const headline = esc(cf(c, 'headline', 'Frequently Asked Questions'))
        const items = cf<{ question: string; answer: string }[]>(c, 'items', [])
        html += `
          <section class="lp-section faq-bc" id="s-${section.id}" style="background:var(--surface-1)">
            <div class="container">
              <div class="animate-on-scroll">
                <span class="eyebrow" style="display:block;text-align:center">FAQ</span>
                <h2>${headline}</h2>
              </div>
              <div class="faq-list animate-on-scroll animate-delay-1" role="list">
                ${items.map(item => `
                  <div class="faq-item" role="listitem">
                    <button class="faq-question" aria-expanded="false">
                      <span>${esc(item.question)}</span>
                      <span class="faq-icon" aria-hidden="true">+</span>
                    </button>
                    <div class="faq-answer" role="region">
                      <div class="faq-answer-inner">${esc(item.answer)}</div>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          </section>`
        break
      }
      case 'final_cta': {
        const headline = esc(cf(c, 'headline', ''))
        const subheadline = esc(cf(c, 'subheadline', ''))
        html += `
          <section class="lp-section final-cta-bc noise-overlay" id="cta-form">
            <div class="orb orb-1" style="width:350px;height:350px"></div>
            <div class="orb orb-2" style="width:280px;height:280px"></div>
            <div class="container text-center" style="position:relative;z-index:2">
              <div class="animate-on-scroll">
                <h2 class="gradient-text">${headline}</h2>
                ${subheadline ? `<p class="sub">${subheadline}</p>` : ''}
                <div class="countdown-row">
                  <span class="countdown-unit">24</span>
                  <span class="countdown-sep">:</span>
                  <span class="countdown-unit">00</span>
                  <span class="countdown-sep">:</span>
                  <span class="countdown-unit">00</span>
                </div>
              </div>
              ${renderForm(offer)}
            </div>
          </section>`
        break
      }
      case 'form': {
        html += `
          <section class="lp-section noise-overlay" id="cta-form" style="background:var(--surface-1)">
            <div class="container">${renderForm(offer, c)}</div>
          </section>`
        break
      }
      case 'comparison': {
        const headline = esc(cf(c, 'headline', ''))
        const clientLabel = esc(cf(c, 'client_name', clientName))
        const compItems = cf<{ feature: string; client: boolean; competitor: boolean }[]>(c, 'items', [])
        html += `
          <section class="lp-section comparison-section comparison-section-bc" id="s-${section.id}" style="background:var(--surface-1)">
            <div class="container">
              <div class="animate-on-scroll">
                <span class="eyebrow" style="display:block;text-align:center">Compare</span>
                ${headline ? `<h2 class="text-center">${headline}</h2>` : ''}
              </div>
              <div class="comparison-table-wrapper animate-on-scroll animate-delay-1">
                <table class="comparison-table">
                  <thead><tr><th></th><th class="client-col">${clientLabel}</th><th>Others</th></tr></thead>
                  <tbody>
                    ${compItems.map(item => `
                      <tr>
                        <td>${esc(item.feature)}</td>
                        <td><span class="${item.client ? 'check-yes' : 'check-no'}">${item.client ? '\u2713' : '\u2717'}</span></td>
                        <td><span class="${item.competitor ? 'check-yes' : 'check-no'}">${item.competitor ? '\u2713' : '\u2717'}</span></td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          </section>`
        break
      }
      case 'process_steps': {
        const headline = esc(cf(c, 'headline', ''))
        const steps = cf<{ number: number; title: string; description: string }[]>(c, 'steps', [])
        html += `
          <section class="lp-section" id="s-${section.id}">
            <div class="container text-center">
              <div class="animate-on-scroll">
                <span class="eyebrow" style="display:block;text-align:center">Process</span>
                ${headline ? `<h2>${headline}</h2>` : ''}
              </div>
              <div class="process-bc-grid">
                ${steps.map((s, i) => `
                  <div class="step-bc-card animate-on-scroll animate-delay-${Math.min(i + 1, 5)}">
                    <div class="num">${s.number}</div>
                    <h3>${esc(s.title)}</h3>
                    <p>${esc(s.description)}</p>
                  </div>
                `).join('')}
              </div>
            </div>
          </section>`
        break
      }
    }
  }
  return html
}

// =========================================================================
// TEMPLATE 3 — Gap Play
// Editorial/magazine feel, two-tone, comparison-centric, story-driven
// =========================================================================

function gapPlayCSS(): string {
  return `
    /* Gap Play — editorial, story-driven, comparison-centric */

    /* Hero — left-aligned editorial */
    .hero-gp {
      min-height: 100vh;
      display: flex;
      align-items: center;
      padding: 120px 0 80px;
      position: relative;
      background:
        radial-gradient(ellipse at 80% 50%, rgba(var(--primary-rgb), 0.08) 0%, transparent 50%),
        radial-gradient(ellipse at 20% 80%, rgba(var(--secondary-rgb), 0.06) 0%, transparent 50%),
        var(--brand-bg);
    }
    .hero-gp .container { position: relative; z-index: 2; }
    .hero-gp h1 {
      font-size: clamp(2.8rem, 6.5vw, 4.5rem);
      font-weight: 900;
      letter-spacing: -0.03em;
      margin-bottom: 24px;
      max-width: 820px;
    }
    .hero-gp .sub {
      font-size: clamp(1.1rem,1.3vw,1.3rem);
      color: var(--text-muted);
      max-width: 580px;
      margin-bottom: 40px;
      line-height: 1.8;
      font-weight: 300;
    }

    /* Comparison table — star feature */
    .comparison-gp { background: var(--surface-1); }
    .comparison-gp h2 { margin-bottom: 48px; }
    .comparison-gp-wrapper {
      max-width: 760px;
      border-radius: var(--radius-lg);
      overflow: hidden;
      border: 1px solid var(--border-subtle);
      background: rgba(255,255,255,0.02);
    }
    .comparison-gp-table {
      width: 100%;
      border-collapse: collapse;
    }
    .comparison-gp-table thead th {
      padding: 20px 24px;
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-weight: 700;
      border-bottom: 2px solid rgba(var(--primary-rgb), 0.3);
      background: rgba(255,255,255,0.03);
    }
    .comparison-gp-table thead th:first-child { text-align: left; }
    .comparison-gp-table thead th:nth-child(2) { color: var(--brand-primary); }
    .comparison-gp-table thead th:nth-child(3) { color: var(--text-dim); }
    .comparison-gp-table td {
      padding: 18px 24px;
      border-bottom: 1px solid var(--border-subtle);
      text-align: center;
    }
    .comparison-gp-table tr:last-child td { border-bottom: none; }
    .comparison-gp-table td:first-child {
      text-align: left;
      font-weight: 500;
      color: var(--text-muted);
    }
    .comparison-gp-table tr:hover td { background: rgba(255,255,255,0.02); }
    .gp-yes { color: var(--brand-primary); font-size: 1.3rem; font-weight: 700; }
    .gp-no { color: #ef4444; font-size: 1.3rem; font-weight: 700; opacity: 0.5; }

    /* Solution — numbered process with connecting line */
    .solution-gp h2 { margin-bottom: 48px; }
    .process-gp {
      position: relative;
      max-width: 680px;
    }
    .process-gp::before {
      content: '';
      position: absolute;
      left: 27px;
      top: 28px;
      bottom: 28px;
      width: 2px;
      background: linear-gradient(to bottom, var(--brand-primary), var(--brand-secondary), var(--brand-accent));
      border-radius: 2px;
    }
    .process-gp-item {
      display: flex;
      gap: 28px;
      align-items: flex-start;
      padding: 24px 0;
      position: relative;
    }
    .process-gp-num {
      flex-shrink: 0;
      width: 56px; height: 56px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--brand-primary), var(--brand-secondary));
      color: #fff;
      display: flex; align-items: center; justify-content: center;
      font-weight: 800; font-size: 1.2rem;
      position: relative; z-index: 1;
      box-shadow: 0 4px 15px rgba(var(--primary-rgb), 0.3), 0 0 0 6px var(--brand-bg);
    }
    .process-gp-body { padding-top: 6px; }
    .process-gp-body h3 { font-size: 1.2rem; margin-bottom: 10px; }
    .process-gp-body p { color: var(--text-muted); line-height: 1.8; }

    /* Benefits — editorial list */
    .benefits-gp h2 { margin-bottom: 48px; }
    .benefit-gp-list { max-width: 700px; }
    .benefit-gp-item {
      padding: 28px 0;
      border-bottom: 1px solid var(--border-subtle);
    }
    .benefit-gp-item:last-child { border-bottom: none; }
    .benefit-gp-item h3 {
      font-size: 1.1rem;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .benefit-gp-check {
      width: 24px; height: 24px;
      border-radius: 50%;
      background: rgba(var(--primary-rgb), 0.12);
      display: inline-flex; align-items: center; justify-content: center;
      color: var(--brand-primary);
      font-size: 0.7rem;
      font-weight: 700;
      flex-shrink: 0;
    }
    .benefit-gp-item p { color: var(--text-muted); line-height: 1.8; padding-left: 36px; }

    /* Proof — case study cards */
    .proof-gp h2 { margin-bottom: 48px; }
    .proof-gp-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 24px;
    }
    .case-study {
      border-radius: var(--radius-lg);
      overflow: hidden;
      border: 1px solid var(--border-subtle);
      background: rgba(255,255,255,0.02);
      transition: all var(--transition);
    }
    .case-study:hover {
      border-color: rgba(var(--primary-rgb), 0.2);
      transform: translateY(-4px);
      box-shadow: var(--shadow-lg);
    }
    .case-study-header {
      padding: 20px 24px;
      background: rgba(255,255,255,0.04);
      font-weight: 700;
      font-size: 0.95rem;
      border-bottom: 1px solid var(--border-subtle);
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .case-study-header::before {
      content: '';
      width: 8px; height: 8px;
      border-radius: 50%;
      background: var(--brand-primary);
    }
    .case-study-body {
      padding: 24px;
    }
    .case-study-body p {
      font-style: italic;
      color: var(--text-muted);
      line-height: 1.7;
      margin-bottom: 16px;
    }
    .case-study-footer {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .case-study-avatar {
      width: 36px; height: 36px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--brand-primary), var(--brand-secondary));
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 0.85rem; color: #fff;
    }
    .case-study-name { font-weight: 600; font-size: 0.9rem; }

    /* FAQ */
    .faq-gp h2 { margin-bottom: 48px; }
    .faq-gp .faq-list { max-width: 720px; }

    /* Final CTA */
    .final-cta-gp {
      padding: 120px 0;
      background: var(--surface-1);
      text-align: center;
      position: relative;
    }
    .final-cta-gp h2 { margin-bottom: 16px; max-width: 640px; margin-left: auto; margin-right: auto; }
    .final-cta-gp .sub {
      max-width: 560px;
      margin: 0 auto 40px;
      color: var(--text-muted);
      font-weight: 300;
    }

    /* Problem section */
    .problem-gp h2 { margin-bottom: 24px; }
    .problem-gp-content { max-width: 700px; }
    .problem-gp-content p { color: var(--text-muted); margin-bottom: 16px; line-height: 1.8; }
    .problem-pullquote {
      font-size: clamp(1.3rem, 2vw, 1.6rem);
      font-weight: 600;
      font-style: italic;
      border-left: 4px solid;
      border-image: linear-gradient(to bottom, var(--brand-primary), var(--brand-secondary)) 1;
      padding: 16px 0 16px 28px;
      margin: 32px 0;
      color: var(--brand-text);
      line-height: 1.5;
    }

    /* Responsive */
    @media (max-width: 1024px) {
      .hero-gp { min-height: auto; padding: 100px 0 80px; }
    }
    @media (max-width: 768px) {
      .hero-gp { padding: 100px 0 64px; }
      .comparison-gp-table th, .comparison-gp-table td { padding: 14px 16px; font-size: 0.88rem; }
      .proof-gp-grid { grid-template-columns: 1fr; }
    }
    @media (max-width: 480px) {
      .hero-gp { padding: 88px 0 48px; }
      .final-cta-gp { padding: 80px 0; }
    }
  `
}

function renderGapPlay(
  sections: PageSectionData[],
  _brandKit: BrandKit,
  offer: Offer,
  clientName: string,
): string {
  const sorted = sortSections(sections)
  let html = ''

  for (const section of sorted) {
    const c = section.content
    switch (section.type) {
      case 'hero': {
        const headline = esc(cf(c, 'headline', ''))
        const subheadline = esc(cf(c, 'subheadline', ''))
        const cta = esc(cf(c, 'cta', offer.primary_cta || 'Get Started'))
        html += `
          <section class="lp-section hero-gp noise-overlay" id="s-${section.id}">
            <div class="orb orb-1" style="right:-150px;top:-100px"></div>
            <div class="orb orb-2" style="left:auto;right:20%;bottom:10%"></div>
            <div class="container">
              <div class="animate-on-scroll">
                <span class="eyebrow">${esc(clientName)}</span>
                <h1>${headline}</h1>
                <p class="sub">${subheadline}</p>
                <a href="#cta-form" class="btn btn-primary btn-large btn-glow">${cta}</a>
              </div>
            </div>
          </section>`
        break
      }
      case 'problem': {
        const headline = esc(cf(c, 'headline', ''))
        const content = esc(cf(c, 'content', ''))
        const paragraphs = content.split('\n').filter(Boolean)
        const firstParagraph = paragraphs[0] || ''
        const restParagraphs = paragraphs.slice(1)
        html += `
          <section class="lp-section problem-gp" id="s-${section.id}">
            <div class="container">
              <div class="animate-on-scroll">
                <span class="eyebrow">The Problem</span>
                ${headline ? `<h2>${headline}</h2>` : ''}
                <div class="problem-gp-content">
                  ${firstParagraph ? `<div class="problem-pullquote">${firstParagraph}</div>` : ''}
                  ${restParagraphs.map(p => `<p>${p}</p>`).join('')}
                </div>
              </div>
            </div>
          </section>`
        break
      }
      case 'solution': {
        const headline = esc(cf(c, 'headline', ''))
        const content = esc(cf(c, 'content', ''))
        const steps = cf<{ title: string; description: string }[]>(c, 'steps', [])
        html += `
          <section class="lp-section solution-gp noise-overlay" id="s-${section.id}" style="background:var(--surface-1)">
            <div class="container">
              <div class="animate-on-scroll">
                <span class="eyebrow">The Solution</span>
                ${headline ? `<h2>${headline}</h2>` : ''}
                ${content ? `<p style="color:var(--text-muted);max-width:640px;margin-bottom:48px">${content}</p>` : ''}
              </div>
              ${steps.length ? `
                <div class="process-gp animate-on-scroll animate-delay-1">
                  ${steps.map((s, i) => `
                    <div class="process-gp-item animate-on-scroll animate-delay-${Math.min(i + 1, 5)}">
                      <div class="process-gp-num">${i + 1}</div>
                      <div class="process-gp-body">
                        <h3>${esc(s.title)}</h3>
                        <p>${esc(s.description)}</p>
                      </div>
                    </div>
                  `).join('')}
                </div>` : ''}
            </div>
          </section>`
        break
      }
      case 'benefits': {
        const headline = esc(cf(c, 'headline', ''))
        const items = cf<string[]>(c, 'items', [])
        html += `
          <section class="lp-section benefits-gp" id="s-${section.id}">
            <div class="container">
              <div class="animate-on-scroll">
                <span class="eyebrow">Benefits</span>
                ${headline ? `<h2>${headline}</h2>` : ''}
              </div>
              <div class="benefit-gp-list">
                ${items.map((item, i) => `
                  <div class="benefit-gp-item animate-on-scroll animate-delay-${Math.min(i + 1, 5)}">
                    <h3><span class="benefit-gp-check">\u2713</span> ${esc(item)}</h3>
                  </div>
                `).join('')}
              </div>
            </div>
          </section>`
        break
      }
      case 'proof': {
        const headline = esc(cf(c, 'headline', ''))
        const items = cf<string[]>(c, 'items', [])
        html += `
          <section class="lp-section proof-gp noise-overlay" id="s-${section.id}" style="background:var(--surface-1)">
            <div class="container">
              <div class="animate-on-scroll">
                <span class="eyebrow">Proof</span>
                ${headline ? `<h2>${headline}</h2>` : ''}
              </div>
              <div class="proof-gp-grid">
                ${items.map((item, i) => {
                  const initials = item.length > 0 ? item.charAt(0).toUpperCase() : '?'
                  return `
                    <div class="case-study animate-on-scroll animate-delay-${Math.min(i + 1, 5)}">
                      <div class="case-study-header">Success Story #${i + 1}</div>
                      <div class="case-study-body">
                        <p>${esc(item)}</p>
                        <div class="case-study-footer">
                          <div class="case-study-avatar">${initials}</div>
                          <span class="case-study-name">Verified Customer</span>
                        </div>
                      </div>
                    </div>`
                }).join('')}
              </div>
            </div>
          </section>`
        break
      }
      case 'faq': {
        const headline = esc(cf(c, 'headline', 'Frequently Asked Questions'))
        const items = cf<{ question: string; answer: string }[]>(c, 'items', [])
        html += `
          <section class="lp-section faq-gp faq-ca" id="s-${section.id}">
            <div class="container">
              <div class="animate-on-scroll">
                <span class="eyebrow">FAQ</span>
                <h2>${headline}</h2>
              </div>
              <div class="faq-list animate-on-scroll animate-delay-1" role="list">
                ${items.map(item => `
                  <div class="faq-item" role="listitem">
                    <button class="faq-question" aria-expanded="false">
                      <span>${esc(item.question)}</span>
                      <span class="faq-icon" aria-hidden="true">+</span>
                    </button>
                    <div class="faq-answer" role="region">
                      <div class="faq-answer-inner">${esc(item.answer)}</div>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          </section>`
        break
      }
      case 'final_cta': {
        const headline = esc(cf(c, 'headline', ''))
        const subheadline = esc(cf(c, 'subheadline', ''))
        html += `
          <section class="lp-section final-cta-gp gradient-mesh noise-overlay" id="cta-form">
            <div class="orb orb-1" style="width:250px;height:250px"></div>
            <div class="orb orb-2" style="width:200px;height:200px"></div>
            <div class="container text-center" style="position:relative;z-index:2">
              <div class="animate-on-scroll">
                <h2 class="gradient-text">${headline}</h2>
                ${subheadline ? `<p class="sub">${subheadline}</p>` : ''}
              </div>
              ${renderForm(offer)}
            </div>
          </section>`
        break
      }
      case 'form': {
        html += `
          <section class="lp-section" id="cta-form" style="background:var(--surface-1)">
            <div class="container">${renderForm(offer, c)}</div>
          </section>`
        break
      }
      case 'urgency_bar': {
        const text = esc(cf(c, 'text', ''))
        html += `<div class="urgency-bar" role="alert"><span class="urgency-dot"></span> ${text}</div>`
        break
      }
      case 'trust_strip': {
        const items = cf<string[]>(c, 'items', [])
        html += `
          <div class="lp-section" style="padding:40px 0;background:var(--surface-1)">
            <div class="container">
              <div class="trust-strip animate-on-scroll">
                ${items.map(i => `<span class="trust-strip-item">${esc(i)}</span>`).join('')}
              </div>
            </div>
          </div>`
        break
      }
      case 'comparison': {
        const headline = esc(cf(c, 'headline', ''))
        const clientLabel = esc(cf(c, 'client_name', clientName))
        const compItems = cf<{ feature: string; client: boolean; competitor: boolean }[]>(c, 'items', [])
        html += `
          <section class="lp-section comparison-gp" id="s-${section.id}">
            <div class="container">
              <div class="animate-on-scroll">
                <span class="eyebrow">Compare</span>
                ${headline ? `<h2>${headline}</h2>` : ''}
              </div>
              <div class="comparison-gp-wrapper animate-on-scroll animate-delay-1">
                <table class="comparison-gp-table">
                  <thead><tr><th>Feature</th><th>${clientLabel}</th><th>Others</th></tr></thead>
                  <tbody>
                    ${compItems.map(item => `
                      <tr>
                        <td>${esc(item.feature)}</td>
                        <td><span class="${item.client ? 'gp-yes' : 'gp-no'}">${item.client ? '\u2713' : '\u2717'}</span></td>
                        <td><span class="${item.competitor ? 'gp-yes' : 'gp-no'}">${item.competitor ? '\u2713' : '\u2717'}</span></td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          </section>`
        break
      }
      case 'process_steps': {
        const headline = esc(cf(c, 'headline', ''))
        const steps = cf<{ number: number; title: string; description: string }[]>(c, 'steps', [])
        html += `
          <section class="lp-section process-section" id="s-${section.id}" style="background:var(--surface-1)">
            <div class="container">
              <div class="animate-on-scroll">
                <span class="eyebrow">Process</span>
                ${headline ? `<h2>${headline}</h2>` : ''}
              </div>
              <div class="process-gp animate-on-scroll animate-delay-1">
                ${steps.map((s, i) => `
                  <div class="process-gp-item animate-on-scroll animate-delay-${Math.min(i + 1, 5)}">
                    <div class="process-gp-num">${s.number}</div>
                    <div class="process-gp-body">
                      <h3>${esc(s.title)}</h3>
                      <p>${esc(s.description)}</p>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          </section>`
        break
      }
    }
  }
  return html
}

// =========================================================================
// TEMPLATE 4 — Aggressive DR
// Maximum visual impact, multiple CTAs, stacked proof, urgency everywhere
// =========================================================================

function aggressiveDrCSS(): string {
  return `
    /* Aggressive DR — maximum impact, urgency, proof-stacking */

    /* Hero — full gradient mesh, massive text */
    .hero-dr {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 120px 0 80px;
      background:
        radial-gradient(ellipse at 20% 20%, rgba(var(--primary-rgb), 0.2) 0%, transparent 50%),
        radial-gradient(ellipse at 80% 80%, rgba(var(--secondary-rgb), 0.15) 0%, transparent 50%),
        radial-gradient(ellipse at 50% 30%, rgba(var(--accent-rgb), 0.08) 0%, transparent 60%),
        linear-gradient(135deg, #08080d, #0f0f1a 50%, #0a0a12);
      position: relative;
    }
    .hero-dr h1 {
      font-size: clamp(2.8rem, 7vw, 5.5rem);
      font-weight: 900;
      margin-bottom: 24px;
      max-width: 950px;
      margin-left: auto;
      margin-right: auto;
      letter-spacing: -0.03em;
    }
    .hero-dr .sub {
      font-size: clamp(1.1rem,1.4vw,1.4rem);
      color: var(--text-muted);
      max-width: 640px;
      margin: 0 auto 40px;
      font-weight: 300;
    }
    .hero-dr .btn-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 16px;
      flex-wrap: wrap;
    }
    .hero-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 20px;
      border-radius: 100px;
      background: rgba(var(--accent-rgb), 0.12);
      border: 1px solid rgba(var(--accent-rgb), 0.25);
      color: var(--brand-accent);
      font-weight: 700;
      font-size: 0.85rem;
      margin-bottom: 24px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    /* Inline CTA breaker */
    .inline-cta-breaker {
      text-align: center;
      padding: 48px 0;
      background:
        linear-gradient(135deg, rgba(var(--primary-rgb), 0.06), rgba(var(--secondary-rgb), 0.04));
      border-top: 1px solid var(--border-subtle);
      border-bottom: 1px solid var(--border-subtle);
    }
    .inline-cta-breaker p {
      margin-bottom: 20px;
      font-size: 1.15rem;
      font-weight: 600;
    }

    /* Problem — dramatic */
    .problem-dr h2 { margin-bottom: 24px; }
    .problem-dr-content {
      max-width: 720px;
    }
    .problem-dr-content p {
      color: var(--text-muted);
      margin-bottom: 16px;
      line-height: 1.8;
    }
    .warning-accent {
      display: flex;
      align-items: flex-start;
      gap: 16px;
      padding: 24px;
      border-radius: var(--radius-md);
      background: rgba(239, 68, 68, 0.06);
      border: 1px solid rgba(239, 68, 68, 0.15);
      margin-top: 24px;
    }
    .warning-icon {
      font-size: 1.5rem;
      flex-shrink: 0;
    }
    .warning-text {
      color: #fca5a5;
      font-weight: 500;
    }

    /* Solution */
    .solution-dr { text-align: center; }
    .solution-dr h2 { margin-bottom: 16px; }
    .solution-dr .lead {
      max-width: 640px;
      margin: 0 auto 56px;
      color: var(--text-muted);
      font-weight: 300;
    }
    .solution-dr-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 24px;
    }
    .solution-dr-card {
      padding: 36px 24px;
      border-radius: var(--radius-lg);
      background: rgba(255,255,255,0.03);
      border: 1px solid var(--border-subtle);
      transition: all var(--transition);
      position: relative;
      overflow: hidden;
      text-align: center;
    }
    .solution-dr-card::before {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, rgba(var(--primary-rgb), 0.05), transparent);
      opacity: 0;
      transition: opacity var(--transition);
    }
    .solution-dr-card:hover::before { opacity: 1; }
    .solution-dr-card:hover {
      transform: translateY(-6px);
      border-color: rgba(var(--primary-rgb), 0.3);
      box-shadow: 0 20px 40px rgba(0,0,0,0.3), 0 0 40px rgba(var(--primary-rgb), 0.1);
    }
    .solution-dr-card .num {
      width: 52px; height: 52px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--brand-primary), var(--brand-secondary));
      color: #fff;
      display: flex; align-items: center; justify-content: center;
      font-weight: 800; font-size: 1.2rem;
      margin: 0 auto 20px;
      box-shadow: 0 4px 15px rgba(var(--primary-rgb), 0.3);
      position: relative; z-index: 1;
    }
    .solution-dr-card h3 { margin-bottom: 10px; position: relative; z-index: 1; }
    .solution-dr-card p { font-size: 0.95rem; color: var(--text-muted); position: relative; z-index: 1; }

    /* Benefits — 2 col with icons */
    .benefits-dr h2 { text-align: center; margin-bottom: 56px; }
    .benefits-dr-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
      max-width: 800px;
      margin: 0 auto;
    }
    .benefit-dr-card {
      padding: 28px 24px;
      border-radius: var(--radius-md);
      background: rgba(255,255,255,0.03);
      border: 1px solid var(--border-subtle);
      display: flex;
      align-items: flex-start;
      gap: 16px;
      transition: all var(--transition);
    }
    .benefit-dr-card:hover {
      background: rgba(255,255,255,0.06);
      border-color: rgba(var(--primary-rgb), 0.2);
      transform: translateY(-3px);
    }
    .benefit-dr-icon {
      width: 28px; height: 28px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--brand-primary), var(--brand-secondary));
      display: flex; align-items: center; justify-content: center;
      color: #fff;
      font-size: 0.7rem;
      font-weight: 700;
      flex-shrink: 0;
      margin-top: 2px;
    }
    .benefit-dr-text { color: var(--text-muted); line-height: 1.6; }

    /* Proof — ribbon cards */
    .proof-dr h2 { text-align: center; margin-bottom: 56px; }
    .proof-dr-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 24px;
    }
    .proof-dr-card {
      padding: 36px 32px;
      border-radius: var(--radius-lg);
      background: rgba(255,255,255,0.04);
      border: 1px solid var(--border-subtle);
      position: relative;
      overflow: hidden;
      transition: all var(--transition);
    }
    .proof-dr-card:hover {
      background: rgba(255,255,255,0.06);
      transform: translateY(-4px);
      box-shadow: var(--shadow-lg);
    }
    .proof-ribbon {
      position: absolute;
      top: 16px; right: -32px;
      background: linear-gradient(135deg, var(--brand-accent), #f97316);
      color: #fff;
      font-size: 0.7rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      padding: 5px 40px;
      transform: rotate(45deg);
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    }
    .proof-dr-card .stars {
      color: var(--brand-accent);
      font-size: 1rem;
      letter-spacing: 3px;
      margin-bottom: 16px;
    }
    .proof-dr-card .text {
      color: var(--text-muted);
      font-style: italic;
      line-height: 1.7;
      margin-bottom: 20px;
    }
    .proof-dr-card .quote-mark {
      font-size: 3rem;
      font-family: Georgia, serif;
      background: linear-gradient(135deg, var(--brand-primary), var(--brand-accent));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      line-height: 1;
      margin-bottom: 8px;
      display: block;
    }
    .proof-dr-author {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .proof-dr-avatar {
      width: 44px; height: 44px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--brand-primary), var(--brand-accent));
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; color: #fff; font-size: 1rem;
    }

    /* FAQ */
    .faq-dr h2 { text-align: center; margin-bottom: 48px; }
    .faq-dr .faq-list { max-width: 720px; margin: 0 auto; }

    /* Final CTA — full gradient */
    .final-cta-dr {
      text-align: center;
      padding: 120px 0;
      background:
        radial-gradient(ellipse at 50% 50%, rgba(var(--primary-rgb), 0.15) 0%, transparent 70%),
        linear-gradient(135deg, rgba(var(--primary-rgb), 0.1), rgba(var(--secondary-rgb), 0.05));
      position: relative;
    }
    .final-cta-dr h2 { margin-bottom: 16px; }
    .final-cta-dr .sub {
      max-width: 560px;
      margin: 0 auto 40px;
      color: var(--text-muted);
      font-weight: 300;
    }

    /* Animated gradient border on final CTA button */
    @keyframes border-gradient-rotate {
      0% { --angle: 0deg; }
      100% { --angle: 360deg; }
    }
    .final-cta-dr .btn-primary {
      position: relative;
      z-index: 1;
    }
    .final-cta-dr .btn-primary::after {
      content: '';
      position: absolute;
      inset: -3px;
      border-radius: inherit;
      background: linear-gradient(135deg, var(--brand-primary), var(--brand-accent), var(--brand-secondary), var(--brand-primary));
      background-size: 300% 300%;
      animation: gradient-shift 3s ease infinite;
      z-index: -1;
      opacity: 0.5;
      filter: blur(8px);
    }

    /* Responsive */
    @media (max-width: 1024px) {
      .hero-dr { min-height: auto; padding: 100px 0 80px; }
    }
    @media (max-width: 768px) {
      .hero-dr { padding: 100px 0 64px; }
      .solution-dr-grid, .benefits-dr-grid { grid-template-columns: 1fr; }
      .proof-dr-grid { grid-template-columns: 1fr; }
      .proof-ribbon { display: none; }
    }
    @media (max-width: 480px) {
      .hero-dr { padding: 88px 0 48px; }
      .final-cta-dr { padding: 80px 0; }
    }
  `
}

function renderAggressiveDr(
  sections: PageSectionData[],
  _brandKit: BrandKit,
  offer: Offer,
  clientName: string,
): string {
  const sorted = sortSections(sections)
  let html = ''
  let sectionCount = 0

  // Inline CTA breaker every few sections
  const ctaText = esc(offer.primary_cta || 'Get Started')
  const maybeInlineCta = () => {
    sectionCount++
    if (sectionCount % 3 === 0) {
      html += `
        <div class="inline-cta-breaker animate-on-scroll">
          <div class="container">
            <p>Ready to take the next step?</p>
            <a href="#cta-form" class="btn btn-primary">${ctaText}</a>
          </div>
        </div>`
    }
  }

  for (const section of sorted) {
    const c = section.content
    switch (section.type) {
      case 'hero': {
        const headline = esc(cf(c, 'headline', ''))
        const subheadline = esc(cf(c, 'subheadline', ''))
        const cta = esc(cf(c, 'cta', offer.primary_cta || 'Get Started'))
        const trustItems = cf<string[]>(c, 'trust_items', [])
        html += `
          <section class="lp-section hero-dr noise-overlay" id="s-${section.id}">
            <div class="orb orb-1"></div>
            <div class="orb orb-2"></div>
            <div class="orb orb-3"></div>
            <div class="container text-center" style="position:relative;z-index:2">
              <div class="animate-on-scroll">
                <span class="hero-badge">\u26A1 Limited Time Offer</span>
                <h1><span class="gradient-text">${headline}</span></h1>
                <p class="sub">${subheadline}</p>
                <div class="btn-row">
                  <a href="#cta-form" class="btn btn-primary btn-large btn-glow">${cta}</a>
                  <a href="#cta-form" class="btn btn-ghost btn-large">See Proof \u2192</a>
                </div>
              </div>
              ${trustItems.length ? `
                <div class="hero-trust-strip animate-on-scroll animate-delay-2">
                  ${trustItems.map(t => `<div class="hero-trust-item"><span class="trust-check">\u2713</span><span>${esc(t)}</span></div>`).join('')}
                </div>` : ''}
            </div>
          </section>`
        break
      }
      case 'urgency_bar': {
        const text = esc(cf(c, 'text', ''))
        html += `<div class="urgency-bar" role="alert"><span class="urgency-dot"></span> ${text}</div>`
        break
      }
      case 'trust_strip': {
        const items = cf<string[]>(c, 'items', [])
        html += `
          <div class="lp-section" style="padding:40px 0;background:var(--surface-1)">
            <div class="container">
              <div class="trust-strip animate-on-scroll">
                ${items.map(i => `<span class="trust-strip-item">${esc(i)}</span>`).join('')}
              </div>
            </div>
          </div>`
        break
      }
      case 'problem': {
        const headline = esc(cf(c, 'headline', ''))
        const content = esc(cf(c, 'content', ''))
        const paragraphs = content.split('\n').filter(Boolean)
        html += `
          <section class="lp-section problem-dr noise-overlay" id="s-${section.id}" style="background:var(--surface-1)">
            <div class="container">
              <div class="animate-on-scroll">
                <span class="eyebrow">\u26A0 The Problem</span>
                ${headline ? `<h2>${headline}</h2>` : ''}
                <div class="problem-dr-content">
                  ${paragraphs.map(p => `<p>${p}</p>`).join('')}
                  <div class="warning-accent">
                    <span class="warning-icon">\u26A0\uFE0F</span>
                    <span class="warning-text">${paragraphs.length > 0 ? paragraphs[paragraphs.length - 1] : 'Don\'t wait until it\'s too late.'}</span>
                  </div>
                </div>
              </div>
            </div>
          </section>`
        maybeInlineCta()
        break
      }
      case 'solution': {
        const headline = esc(cf(c, 'headline', ''))
        const content = esc(cf(c, 'content', ''))
        const steps = cf<{ title: string; description: string }[]>(c, 'steps', [])
        html += `
          <section class="lp-section solution-dr" id="s-${section.id}">
            <div class="container">
              <div class="animate-on-scroll">
                <span class="eyebrow" style="display:block;text-align:center">The Solution</span>
                ${headline ? `<h2>${headline}</h2>` : ''}
                ${content ? `<p class="lead">${content}</p>` : ''}
              </div>
              ${steps.length ? `
                <div class="solution-dr-grid">
                  ${steps.map((s, i) => `
                    <div class="solution-dr-card animate-on-scroll animate-delay-${Math.min(i + 1, 5)}">
                      <div class="num">${i + 1}</div>
                      <h3>${esc(s.title)}</h3>
                      <p>${esc(s.description)}</p>
                    </div>
                  `).join('')}
                </div>` : ''}
            </div>
          </section>`
        maybeInlineCta()
        break
      }
      case 'benefits': {
        const headline = esc(cf(c, 'headline', ''))
        const items = cf<string[]>(c, 'items', [])
        html += `
          <section class="lp-section benefits-dr noise-overlay" id="s-${section.id}" style="background:var(--surface-1)">
            <div class="container">
              <div class="animate-on-scroll">
                <span class="eyebrow" style="display:block;text-align:center">What You Get</span>
                ${headline ? `<h2>${headline}</h2>` : ''}
              </div>
              <div class="benefits-dr-grid">
                ${items.map((item, i) => `
                  <div class="benefit-dr-card animate-on-scroll animate-delay-${Math.min(i + 1, 5)}">
                    <span class="benefit-dr-icon">\u2713</span>
                    <span class="benefit-dr-text">${esc(item)}</span>
                  </div>
                `).join('')}
              </div>
            </div>
          </section>`
        maybeInlineCta()
        break
      }
      case 'proof': {
        const headline = esc(cf(c, 'headline', ''))
        const items = cf<string[]>(c, 'items', [])
        html += `
          <section class="lp-section proof-dr" id="s-${section.id}">
            <div class="container">
              <div class="animate-on-scroll">
                <span class="eyebrow" style="display:block;text-align:center">Real Results</span>
                ${headline ? `<h2>${headline}</h2>` : ''}
              </div>
              <div class="proof-dr-grid">
                ${items.map((item, i) => {
                  const initials = item.length > 0 ? item.charAt(0).toUpperCase() : '?'
                  return `
                    <div class="proof-dr-card animate-on-scroll animate-delay-${Math.min(i + 1, 5)}">
                      <div class="proof-ribbon">Verified</div>
                      <span class="quote-mark">\u201C</span>
                      <div class="stars">\u2605\u2605\u2605\u2605\u2605</div>
                      <p class="text">${esc(item)}</p>
                      <div class="proof-dr-author">
                        <div class="proof-dr-avatar">${initials}</div>
                        <div>
                          <div style="font-weight:600;font-size:0.95rem">Verified Customer</div>
                          <div style="font-size:0.8rem;color:var(--text-dim)">Customer #${1000 + i}</div>
                        </div>
                      </div>
                    </div>`
                }).join('')}
              </div>
            </div>
          </section>`
        maybeInlineCta()
        break
      }
      case 'faq': {
        const headline = esc(cf(c, 'headline', 'Frequently Asked Questions'))
        const items = cf<{ question: string; answer: string }[]>(c, 'items', [])
        html += `
          <section class="lp-section faq-dr faq-ca" id="s-${section.id}" style="background:var(--surface-1)">
            <div class="container">
              <div class="animate-on-scroll">
                <span class="eyebrow" style="display:block;text-align:center">FAQ</span>
                <h2>${headline}</h2>
              </div>
              <div class="faq-list animate-on-scroll animate-delay-1" role="list">
                ${items.map(item => `
                  <div class="faq-item" role="listitem">
                    <button class="faq-question" aria-expanded="false">
                      <span>${esc(item.question)}</span>
                      <span class="faq-icon" aria-hidden="true">+</span>
                    </button>
                    <div class="faq-answer" role="region">
                      <div class="faq-answer-inner">${esc(item.answer)}</div>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          </section>`
        break
      }
      case 'final_cta': {
        const headline = esc(cf(c, 'headline', ''))
        const subheadline = esc(cf(c, 'subheadline', ''))
        html += `
          <section class="lp-section final-cta-dr gradient-mesh noise-overlay" id="cta-form">
            <div class="orb orb-1" style="width:350px;height:350px"></div>
            <div class="orb orb-2" style="width:280px;height:280px"></div>
            <div class="orb orb-3" style="width:200px;height:200px;top:30%;left:30%"></div>
            <div class="container text-center" style="position:relative;z-index:2">
              <div class="animate-on-scroll">
                <span class="hero-badge">\u{1F525} Last Chance</span>
                <h2 class="gradient-text" style="font-size:clamp(2rem,5vw,3.5rem)">${headline}</h2>
                ${subheadline ? `<p class="sub">${subheadline}</p>` : ''}
              </div>
              ${renderForm(offer)}
            </div>
          </section>`
        break
      }
      case 'form': {
        html += `
          <section class="lp-section final-cta-dr noise-overlay" id="cta-form" style="background:var(--surface-1)">
            <div class="container">${renderForm(offer, c)}</div>
          </section>`
        break
      }
      case 'comparison': {
        const headline = esc(cf(c, 'headline', ''))
        const clientLabel = esc(cf(c, 'client_name', clientName))
        const compItems = cf<{ feature: string; client: boolean; competitor: boolean }[]>(c, 'items', [])
        html += `
          <section class="lp-section comparison-section" id="s-${section.id}">
            <div class="container">
              <div class="animate-on-scroll">
                <span class="eyebrow" style="display:block;text-align:center">Compare</span>
                ${headline ? `<h2 class="text-center">${headline}</h2>` : ''}
              </div>
              <div class="comparison-table-wrapper animate-on-scroll animate-delay-1">
                <table class="comparison-table">
                  <thead><tr><th></th><th class="client-col">${clientLabel}</th><th>Others</th></tr></thead>
                  <tbody>
                    ${compItems.map(item => `
                      <tr>
                        <td>${esc(item.feature)}</td>
                        <td><span class="${item.client ? 'check-yes' : 'check-no'}">${item.client ? '\u2713' : '\u2717'}</span></td>
                        <td><span class="${item.competitor ? 'check-yes' : 'check-no'}">${item.competitor ? '\u2713' : '\u2717'}</span></td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          </section>`
        maybeInlineCta()
        break
      }
      case 'process_steps': {
        const headline = esc(cf(c, 'headline', ''))
        const steps = cf<{ number: number; title: string; description: string }[]>(c, 'steps', [])
        html += `
          <section class="lp-section" id="s-${section.id}" style="background:var(--surface-1)">
            <div class="container text-center">
              <div class="animate-on-scroll">
                <span class="eyebrow" style="display:block;text-align:center">Your Path Forward</span>
                ${headline ? `<h2>${headline}</h2>` : ''}
              </div>
              <div class="solution-dr-grid">
                ${steps.map((s, i) => `
                  <div class="solution-dr-card animate-on-scroll animate-delay-${Math.min(i + 1, 5)}">
                    <div class="num">${s.number}</div>
                    <h3>${esc(s.title)}</h3>
                    <p>${esc(s.description)}</p>
                  </div>
                `).join('')}
              </div>
            </div>
          </section>`
        maybeInlineCta()
        break
      }
    }
  }
  return html
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function renderLandingPage(
  templateId: string,
  sections: PageSectionData[],
  brandKit: BrandKit,
  offer: Offer,
  clientName: string,
  logoUrl?: string,
): string {
  // Normalise inputs
  const bk: BrandKit = brandKit || {}
  const headingFont = bk.typography?.heading_font || 'Inter'
  const bodyFont = bk.typography?.body_font || 'Inter'
  const safeSections = Array.isArray(sections) ? sections : []

  // Extract CTA for nav
  const heroSection = safeSections.find(s => s.type === 'hero')
  const navCtaText = heroSection
    ? cf(heroSection.content, 'cta', offer.primary_cta || 'Get Started') as string
    : (offer.primary_cta || 'Get Started')

  // Select template CSS + renderer
  let templateCSS: string
  let bodyHtml: string

  switch (templateId as TemplateId) {
    case 'bold_conversion':
      templateCSS = boldConversionCSS()
      bodyHtml = renderBoldConversion(safeSections, bk, offer, clientName)
      break
    case 'gap_play':
      templateCSS = gapPlayCSS()
      bodyHtml = renderGapPlay(safeSections, bk, offer, clientName)
      break
    case 'aggressive_dr':
      templateCSS = aggressiveDrCSS()
      bodyHtml = renderAggressiveDr(safeSections, bk, offer, clientName)
      break
    case 'clean_authority':
    default:
      templateCSS = cleanAuthorityCSS()
      bodyHtml = renderCleanAuthority(safeSections, bk, offer, clientName)
      break
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(clientName)}</title>
  ${googleFontsLink(headingFont, bodyFont)}
  <style>
    ${cssVars(bk)}
    ${BASE_CSS}
    ${NAV_CSS}
    ${FORM_CSS}
    ${templateCSS}
  </style>
</head>
<body>
  ${renderNav(clientName, logoUrl, navCtaText)}
  <main>
    ${bodyHtml}
  </main>
  <footer style="text-align:center;padding:48px 32px;font-size:0.8rem;color:var(--text-dim);border-top:1px solid var(--border-subtle)">
    &copy; ${new Date().getFullYear()} ${esc(clientName)}. All rights reserved.
  </footer>
  ${SHARED_JS}
</body>
</html>`
}
