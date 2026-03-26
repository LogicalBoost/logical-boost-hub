// Template Renderer — generates self-contained HTML landing pages
// from structured section data + brand kit.
// Used by Supabase Edge Functions (Deno runtime).

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
      families.push(f.replace(/ /g, '+') + ':wght@400;500;600;700;800;900')
    }
  }
  addFont(heading)
  if (body !== heading) addFont(body)
  if (families.length === 0) return ''
  return `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?${families.map(f => `family=${f}`).join('&')}&display=swap" rel="stylesheet">`
}

/** Resolve CSS custom properties from brand kit with sensible defaults. */
function cssVars(bk: BrandKit): string {
  const primary = bk.colors?.primary_color || '#2563eb'
  const secondary = bk.colors?.secondary_color || '#1e40af'
  const accent = bk.colors?.accent_color || '#f59e0b'
  const bg = bk.colors?.background_color || '#ffffff'
  const text = bk.colors?.text_color || '#1f2937'
  const headingFont = bk.typography?.heading_font || 'Inter'
  const bodyFont = bk.typography?.body_font || 'Inter'
  const btnRadius =
    bk.button_style?.shape === 'rounded'
      ? '50px'
      : bk.button_style?.shape === 'square'
        ? '0'
        : '8px'
  const btnColor = bk.button_style?.color || primary
  const btnText = bk.button_style?.text_color || '#ffffff'

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

    /* Derived */
    --brand-primary-light: ${primary}18;
    --brand-primary-mid: ${primary}30;
    --surface: #f9fafb;
    --surface-alt: #f3f4f6;
    --border-light: #e5e7eb;
    --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
    --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1);
    --shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1);
    --shadow-xl: 0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1);
    --radius-sm: 6px;
    --radius-md: 12px;
    --radius-lg: 16px;
    --transition: 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }`
}

// ---------------------------------------------------------------------------
// Shared base CSS (reset + typography + buttons + utilities)
// ---------------------------------------------------------------------------

const BASE_CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; -webkit-text-size-adjust: 100%; }
  body {
    font-family: var(--body-font);
    color: var(--brand-text);
    background: var(--brand-bg);
    line-height: 1.65;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    overflow-x: hidden;
  }
  img { max-width: 100%; display: block; }
  a { color: var(--brand-primary); text-decoration: none; }
  h1, h2, h3, h4, h5, h6 {
    font-family: var(--heading-font);
    line-height: 1.2;
    font-weight: 700;
    color: var(--brand-text);
  }
  h1 { font-size: clamp(2rem, 5vw, 3.5rem); }
  h2 { font-size: clamp(1.6rem, 3.5vw, 2.5rem); }
  h3 { font-size: clamp(1.2rem, 2.5vw, 1.75rem); }
  p { font-size: clamp(1rem, 1.1vw, 1.125rem); }

  .container {
    width: 100%;
    max-width: 1140px;
    margin: 0 auto;
    padding: 0 24px;
  }
  .container-narrow {
    width: 100%;
    max-width: 800px;
    margin: 0 auto;
    padding: 0 24px;
  }

  /* Buttons */
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 16px 36px;
    font-family: var(--heading-font);
    font-size: clamp(0.95rem, 1.1vw, 1.1rem);
    font-weight: 600;
    border: none;
    border-radius: var(--btn-radius);
    cursor: pointer;
    transition: transform var(--transition), box-shadow var(--transition), background var(--transition);
    text-align: center;
    line-height: 1.3;
  }
  .btn:hover { transform: translateY(-2px); box-shadow: var(--shadow-lg); }
  .btn:active { transform: translateY(0); }
  .btn:focus-visible { outline: 3px solid var(--brand-accent); outline-offset: 2px; }
  .btn-primary {
    background: var(--btn-color);
    color: var(--btn-text);
  }
  .btn-primary:hover { filter: brightness(1.08); }
  .btn-secondary {
    background: transparent;
    color: var(--brand-primary);
    border: 2px solid var(--brand-primary);
  }
  .btn-secondary:hover { background: var(--brand-primary-light); }
  .btn-large { padding: 20px 48px; font-size: clamp(1.05rem, 1.2vw, 1.25rem); }
  .btn-full { width: 100%; }

  /* Form elements */
  .form-group { margin-bottom: 16px; }
  .form-group label {
    display: block;
    font-weight: 600;
    font-size: 0.9rem;
    margin-bottom: 6px;
    color: var(--brand-text);
  }
  .form-group input,
  .form-group select,
  .form-group textarea {
    width: 100%;
    padding: 14px 16px;
    font-family: var(--body-font);
    font-size: 1rem;
    border: 1.5px solid var(--border-light);
    border-radius: var(--radius-sm);
    background: var(--brand-bg);
    color: var(--brand-text);
    transition: border-color var(--transition), box-shadow var(--transition);
  }
  .form-group input:focus,
  .form-group select:focus,
  .form-group textarea:focus {
    outline: none;
    border-color: var(--brand-primary);
    box-shadow: 0 0 0 3px var(--brand-primary-mid);
  }

  /* Utility */
  .text-center { text-align: center; }
  .text-muted { opacity: 0.7; }
  .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); border: 0; }

  /* Responsive */
  @media (max-width: 1024px) {
    .container { padding: 0 20px; }
  }
  @media (max-width: 768px) {
    .container, .container-narrow { padding: 0 16px; }
  }
  @media (max-width: 480px) {
    .container, .container-narrow { padding: 0 12px; }
    .btn { padding: 14px 24px; }
    .btn-large { padding: 16px 32px; }
  }
`

// ---------------------------------------------------------------------------
// Shared JS (FAQ accordion + smooth scroll + mobile nav)
// ---------------------------------------------------------------------------

const SHARED_JS = `
<script>
(function(){
  // FAQ accordion
  document.querySelectorAll('.faq-question').forEach(function(btn){
    btn.addEventListener('click', function(){
      var item = this.closest('.faq-item');
      var isOpen = item.classList.contains('open');
      // Close all
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
  var nav = document.querySelector('.mobile-nav');
  if(toggle && nav){
    toggle.addEventListener('click', function(){
      nav.classList.toggle('open');
      this.setAttribute('aria-expanded', nav.classList.contains('open'));
    });
  }
})();
</script>`

// ---------------------------------------------------------------------------
// Form renderer (by conversion type)
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
  const darkClass = variant === 'dark' ? ' form-dark' : ''

  let fieldsHtml = ''
  switch (offer.conversion_type) {
    case 'phone_call':
      return `
        <div class="form-section${darkClass}">
          ${headline ? `<h3>${headline}</h3>` : ''}
          ${subheadline ? `<p class="text-muted">${subheadline}</p>` : ''}
          <a href="tel:" class="btn btn-primary btn-large btn-full phone-cta" aria-label="Call now">
            <span style="font-size:1.4em">&#9742;</span> ${ctaText || 'Call Now'}
          </a>
        </div>`
    case 'booking':
      fieldsHtml = `
        <div class="form-group"><label for="fname">Full Name</label><input type="text" id="fname" name="name" placeholder="Your full name" required></div>
        <div class="form-group"><label for="femail">Email Address</label><input type="email" id="femail" name="email" placeholder="you@email.com" required></div>
        <div class="form-group"><label for="fdate">Preferred Date</label><input type="date" id="fdate" name="date" required></div>`
      break
    case 'purchase':
      fieldsHtml = `
        <div class="form-group"><label for="femail">Email Address</label><input type="email" id="femail" name="email" placeholder="you@email.com" required></div>`
      break
    default: // lead_form
      fieldsHtml = `
        <div class="form-group"><label for="fname">Full Name</label><input type="text" id="fname" name="name" placeholder="Your full name" required></div>
        <div class="form-group"><label for="femail">Email Address</label><input type="email" id="femail" name="email" placeholder="you@email.com" required></div>
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
    <form class="lp-form${darkClass}" onsubmit="event.preventDefault()">
      ${headline ? `<h3>${headline}</h3>` : ''}
      ${subheadline ? `<p class="form-sub text-muted">${subheadline}</p>` : ''}
      ${fieldsHtml}
      <button type="submit" class="btn btn-primary btn-full">${ctaText}</button>
    </form>`
}

// ---------------------------------------------------------------------------
// Section renderers — each template set overrides the render style
// ---------------------------------------------------------------------------

/** Sort and filter sections, handle missing gracefully. */
function sortSections(sections: PageSectionData[]): PageSectionData[] {
  return [...sections].sort((a, b) => a.order - b.order)
}

// =========================================================================
// TEMPLATE 1 — Clean Authority
// =========================================================================

function cleanAuthorityCSS(): string {
  return `
    /* Clean Authority — generous whitespace, calm professional aesthetic */
    .lp-section { padding: 80px 0; }
    .lp-section:nth-child(even) { background: var(--surface); }

    /* Hero */
    .hero-ca { padding: 100px 0 80px; text-align: center; }
    .hero-ca h1 { margin-bottom: 20px; max-width: 800px; margin-left: auto; margin-right: auto; }
    .hero-ca h1 span {
      background: linear-gradient(135deg, var(--brand-primary), var(--brand-secondary));
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .hero-ca .sub { font-size: clamp(1.05rem,1.3vw,1.25rem); color: var(--brand-text); opacity: 0.75; max-width: 640px; margin: 0 auto 36px; }
    .hero-trust { display: flex; align-items: center; justify-content: center; gap: 24px; margin-top: 40px; flex-wrap: wrap; font-size: 0.9rem; opacity: 0.65; }
    .hero-trust span::before { content: '\\2713 '; color: var(--brand-primary); font-weight: 700; }

    /* Problem */
    .problem-ca .content-block {
      border-left: 4px solid var(--brand-primary);
      padding-left: 28px;
      max-width: 700px;
    }
    .problem-ca .content-block p { margin-bottom: 18px; }
    .problem-ca h2 { margin-bottom: 28px; }

    /* Solution */
    .solution-ca { text-align: center; }
    .solution-ca h2 { margin-bottom: 16px; }
    .solution-ca .lead { max-width: 640px; margin: 0 auto 48px; opacity: 0.8; font-size: clamp(1.02rem,1.15vw,1.15rem); }
    .solution-grid {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 32px;
    }
    .solution-card {
      padding: 32px 24px;
      border-radius: var(--radius-md);
      background: var(--brand-bg);
      box-shadow: var(--shadow-sm);
      transition: box-shadow var(--transition), transform var(--transition);
    }
    .solution-card:hover { box-shadow: var(--shadow-md); transform: translateY(-3px); }
    .solution-card .icon { font-size: 2.2rem; margin-bottom: 16px; }
    .solution-card h3 { margin-bottom: 10px; font-size: 1.15rem; }
    .solution-card p { font-size: 0.95rem; opacity: 0.75; }

    /* Benefits */
    .benefits-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; }
    .benefits-ca h2 { text-align: center; margin-bottom: 44px; }
    .benefit-card {
      padding: 28px;
      border: 1.5px solid var(--border-light);
      border-radius: var(--radius-md);
      transition: border-color var(--transition), box-shadow var(--transition);
    }
    .benefit-card:hover { border-color: var(--brand-primary); box-shadow: var(--shadow-sm); }
    .benefit-card .check { color: var(--brand-primary); font-weight: 700; font-size: 1.3rem; margin-bottom: 10px; display: block; }

    /* Proof */
    .proof-ca h2 { text-align: center; margin-bottom: 44px; }
    .proof-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 28px; }
    .testimonial-card {
      padding: 32px;
      border-radius: var(--radius-md);
      background: var(--brand-bg);
      box-shadow: var(--shadow-sm);
      position: relative;
    }
    .testimonial-card::before {
      content: '\\201C';
      font-size: 4rem;
      font-family: Georgia, serif;
      color: var(--brand-primary);
      opacity: 0.2;
      position: absolute;
      top: 12px; left: 24px;
      line-height: 1;
    }
    .testimonial-card .text { font-style: italic; margin-bottom: 16px; padding-top: 20px; opacity: 0.85; }
    .testimonial-card .author { font-weight: 600; font-size: 0.9rem; }

    /* FAQ */
    .faq-ca h2 { text-align: center; margin-bottom: 40px; }
    .faq-list { max-width: 720px; margin: 0 auto; }
    .faq-item { border-bottom: 1px solid var(--border-light); }
    .faq-question {
      width: 100%; background: none; border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: space-between;
      padding: 22px 0; font-family: var(--heading-font);
      font-size: clamp(1rem,1.1vw,1.1rem); font-weight: 600;
      color: var(--brand-text); text-align: left;
    }
    .faq-question:hover { color: var(--brand-primary); }
    .faq-question:focus-visible { outline: 2px solid var(--brand-primary); outline-offset: 4px; }
    .faq-icon { font-size: 1.4rem; flex-shrink: 0; margin-left: 16px; transition: transform var(--transition); }
    .faq-answer { max-height: 0; overflow: hidden; transition: max-height 0.35s ease; }
    .faq-answer-inner { padding: 0 0 22px; opacity: 0.8; line-height: 1.7; }

    /* Final CTA */
    .final-cta-ca { text-align: center; background: var(--surface); padding: 100px 0; }
    .final-cta-ca h2 { margin-bottom: 16px; }
    .final-cta-ca .sub { max-width: 560px; margin: 0 auto 36px; opacity: 0.75; font-size: clamp(1rem,1.1vw,1.1rem); }

    /* Form */
    .lp-form { max-width: 420px; margin: 0 auto; padding: 36px; background: var(--brand-bg); border-radius: var(--radius-md); box-shadow: var(--shadow-md); }
    .lp-form h3 { margin-bottom: 8px; text-align: center; }
    .lp-form .form-sub { text-align: center; margin-bottom: 20px; font-size: 0.95rem; }
    .form-section { text-align: center; }
    .phone-cta { margin-top: 24px; font-size: 1.2rem; }

    /* Trust strip */
    .trust-strip { display: flex; align-items: center; justify-content: center; gap: 32px; flex-wrap: wrap; padding: 24px 0; font-size: 0.95rem; font-weight: 600; opacity: 0.6; }

    /* Urgency bar */
    .urgency-bar { background: var(--brand-accent); color: #fff; text-align: center; padding: 14px 24px; font-weight: 700; font-size: 0.95rem; letter-spacing: 0.03em; }

    /* Comparison */
    .comparison-table { width: 100%; border-collapse: collapse; max-width: 700px; margin: 32px auto 0; }
    .comparison-table th, .comparison-table td { padding: 14px 20px; text-align: center; border-bottom: 1px solid var(--border-light); }
    .comparison-table th { font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.06em; opacity: 0.6; }
    .comparison-table td:first-child { text-align: left; font-weight: 500; }
    .check-yes { color: var(--brand-primary); font-weight: 700; font-size: 1.2rem; }
    .check-no { color: #ef4444; font-weight: 700; font-size: 1.2rem; }

    /* Process steps */
    .process-steps { display: flex; flex-direction: column; gap: 36px; max-width: 640px; margin: 36px auto 0; position: relative; }
    .process-steps::before { content: ''; position: absolute; left: 22px; top: 10px; bottom: 10px; width: 2px; background: var(--border-light); }
    .step-item { display: flex; gap: 20px; align-items: flex-start; position: relative; }
    .step-num {
      flex-shrink: 0; width: 44px; height: 44px; border-radius: 50%;
      background: var(--brand-primary); color: #fff; display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 1rem; position: relative; z-index: 1;
    }
    .step-body h3 { font-size: 1.1rem; margin-bottom: 6px; }
    .step-body p { font-size: 0.95rem; opacity: 0.75; }

    /* Responsive */
    @media (max-width: 1024px) {
      .lp-section { padding: 64px 0; }
      .hero-ca { padding: 80px 0 64px; }
    }
    @media (max-width: 768px) {
      .lp-section { padding: 52px 0; }
      .hero-ca { padding: 64px 0 48px; }
      .solution-grid, .benefits-grid { grid-template-columns: 1fr; gap: 20px; }
      .proof-grid { grid-template-columns: 1fr; }
      .hero-trust { gap: 12px; }
      .comparison-table th, .comparison-table td { padding: 10px 12px; font-size: 0.9rem; }
      .trust-strip { gap: 16px; font-size: 0.85rem; }
    }
    @media (max-width: 480px) {
      .lp-section { padding: 40px 0; }
      .hero-ca { padding: 48px 0 36px; }
      .lp-form { padding: 24px 16px; }
      .final-cta-ca { padding: 60px 0; }
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

  for (const section of sorted) {
    const c = section.content
    switch (section.type) {
      case 'hero': {
        const headline = esc(cf(c, 'headline', ''))
        const subheadline = esc(cf(c, 'subheadline', ''))
        const cta = esc(cf(c, 'cta', offer.primary_cta || 'Get Started'))
        const trustItems = cf<string[]>(c, 'trust_items', [])
        html += `
          <section class="lp-section hero-ca" id="s-${section.id}">
            <div class="container text-center">
              <h1><span>${headline}</span></h1>
              <p class="sub">${subheadline}</p>
              <a href="#cta-form" class="btn btn-primary btn-large">${cta}</a>
              ${trustItems.length ? `<div class="hero-trust">${trustItems.map(t => `<span>${esc(t)}</span>`).join('')}</div>` : ''}
            </div>
          </section>`
        break
      }
      case 'problem': {
        const headline = esc(cf(c, 'headline', ''))
        const content = esc(cf(c, 'content', ''))
        html += `
          <section class="lp-section problem-ca" id="s-${section.id}">
            <div class="container">
              ${headline ? `<h2>${headline}</h2>` : ''}
              <div class="content-block">${content.split('\n').filter(Boolean).map(p => `<p>${p}</p>`).join('')}</div>
            </div>
          </section>`
        break
      }
      case 'solution': {
        const headline = esc(cf(c, 'headline', ''))
        const content = esc(cf(c, 'content', ''))
        const steps = cf<{ title: string; description: string }[]>(c, 'steps', [])
        const icons = ['\u{1F3AF}', '\u{1F4A1}', '\u{1F680}', '\u{2728}', '\u{1F4CA}', '\u{1F50D}']
        html += `
          <section class="lp-section solution-ca" id="s-${section.id}">
            <div class="container">
              ${headline ? `<h2>${headline}</h2>` : ''}
              ${content ? `<p class="lead">${content}</p>` : ''}
              ${steps.length ? `
                <div class="solution-grid">
                  ${steps.map((s, i) => `
                    <div class="solution-card">
                      <div class="icon">${icons[i % icons.length]}</div>
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
          <section class="lp-section benefits-ca" id="s-${section.id}">
            <div class="container">
              ${headline ? `<h2>${headline}</h2>` : ''}
              <div class="benefits-grid">
                ${items.map(item => `
                  <div class="benefit-card">
                    <span class="check">\u2713</span>
                    <p>${esc(item)}</p>
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
          <section class="lp-section proof-ca" id="s-${section.id}">
            <div class="container">
              ${headline ? `<h2>${headline}</h2>` : ''}
              <div class="proof-grid">
                ${items.map(item => `
                  <div class="testimonial-card">
                    <p class="text">${esc(item)}</p>
                    <p class="author">&mdash; Verified Customer</p>
                  </div>
                `).join('')}
              </div>
            </div>
          </section>`
        break
      }
      case 'faq': {
        const headline = esc(cf(c, 'headline', 'Frequently Asked Questions'))
        const items = cf<{ question: string; answer: string }[]>(c, 'items', [])
        html += `
          <section class="lp-section faq-ca" id="s-${section.id}">
            <div class="container">
              <h2>${headline}</h2>
              <div class="faq-list" role="list">
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
        const cta = esc(cf(c, 'cta', offer.primary_cta || 'Get Started'))
        html += `
          <section class="lp-section final-cta-ca" id="cta-form">
            <div class="container text-center">
              <h2>${headline}</h2>
              ${subheadline ? `<p class="sub">${subheadline}</p>` : ''}
              ${offer.conversion_type === 'phone_call'
                ? `<a href="tel:" class="btn btn-primary btn-large"><span style="font-size:1.2em">&#9742;</span> ${cta}</a>`
                : `<a href="#cta-form" class="btn btn-primary btn-large">${cta}</a>`
              }
            </div>
          </section>`
        break
      }
      case 'form': {
        html += `
          <section class="lp-section" id="cta-form">
            <div class="container">${renderForm(offer, c)}</div>
          </section>`
        break
      }
      case 'urgency_bar': {
        const text = esc(cf(c, 'text', ''))
        html += `<div class="urgency-bar" role="alert">${text}</div>`
        break
      }
      case 'trust_strip': {
        const items = cf<string[]>(c, 'items', [])
        html += `
          <div class="lp-section" style="padding:32px 0">
            <div class="container"><div class="trust-strip">${items.map(i => `<span>${esc(i)}</span>`).join('')}</div></div>
          </div>`
        break
      }
      case 'comparison': {
        const headline = esc(cf(c, 'headline', ''))
        const clientLabel = esc(cf(c, 'client_name', _clientName))
        const compItems = cf<{ feature: string; client: boolean; competitor: boolean }[]>(c, 'items', [])
        html += `
          <section class="lp-section" id="s-${section.id}">
            <div class="container text-center">
              ${headline ? `<h2>${headline}</h2>` : ''}
              <table class="comparison-table">
                <thead><tr><th></th><th>${clientLabel}</th><th>Others</th></tr></thead>
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
          </section>`
        break
      }
      case 'process_steps': {
        const headline = esc(cf(c, 'headline', ''))
        const steps = cf<{ number: number; title: string; description: string }[]>(c, 'steps', [])
        html += `
          <section class="lp-section" id="s-${section.id}">
            <div class="container">
              ${headline ? `<h2 class="text-center" style="margin-bottom:8px">${headline}</h2>` : ''}
              <div class="process-steps">
                ${steps.map(s => `
                  <div class="step-item">
                    <div class="step-num">${s.number}</div>
                    <div class="step-body"><h3>${esc(s.title)}</h3><p>${esc(s.description)}</p></div>
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
// TEMPLATE 2 — Bold Conversion
// =========================================================================

function boldConversionCSS(): string {
  return `
    /* Bold Conversion — full-bleed alternating bg, strong contrast, urgency */
    .lp-section-bc { padding: 80px 0; }
    .bg-primary { background: var(--brand-primary); color: #fff; }
    .bg-primary h2, .bg-primary h3, .bg-primary p, .bg-primary .benefit-text { color: #fff; }
    .bg-dark { background: #111827; color: #f3f4f6; }
    .bg-dark h2, .bg-dark h3, .bg-dark p { color: #f3f4f6; }
    .bg-light { background: var(--surface); }
    .bg-white { background: var(--brand-bg); }

    /* Hero */
    .hero-bc { padding: 100px 0 60px; text-align: center; }
    .hero-bc h1 { font-size: clamp(2.4rem,6vw,4rem); font-weight: 900; margin-bottom: 20px; max-width: 900px; margin-left: auto; margin-right: auto; letter-spacing: -0.02em; }
    .hero-bc .sub { font-size: clamp(1.05rem,1.3vw,1.3rem); opacity: 0.8; max-width: 640px; margin: 0 auto 36px; }
    .hero-bc .btn { margin-bottom: 16px; }
    .hero-urgency-line { font-size: 0.9rem; font-weight: 600; color: var(--brand-accent); margin-top: 8px; }

    /* Urgency bar */
    .urgency-bar-bc {
      background: linear-gradient(90deg, var(--brand-accent), #f97316);
      color: #fff; text-align: center; padding: 16px 24px;
      font-weight: 800; font-size: clamp(0.9rem,1.1vw,1.05rem);
      letter-spacing: 0.04em; text-transform: uppercase;
    }

    /* Trust strip */
    .trust-strip-bc {
      display: flex; align-items: center; justify-content: center;
      gap: 40px; flex-wrap: wrap; padding: 40px 24px;
    }
    .trust-stat { text-align: center; }
    .trust-stat .num { font-size: clamp(1.8rem,3vw,2.8rem); font-weight: 900; font-family: var(--heading-font); color: var(--brand-primary); display: block; }
    .trust-stat .lbl { font-size: 0.85rem; opacity: 0.65; text-transform: uppercase; letter-spacing: 0.04em; }

    /* Problem — split */
    .problem-bc-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; align-items: center; }
    .problem-bc-grid h2 { margin-bottom: 20px; }
    .problem-bc-grid .icon-block {
      display: flex; align-items: center; justify-content: center;
      font-size: 6rem; opacity: 0.15;
    }
    .problem-bc-grid p { margin-bottom: 14px; opacity: 0.85; }

    /* Solution band */
    .solution-bc-band { text-align: center; }
    .solution-bc-band h2 { margin-bottom: 16px; font-size: clamp(1.8rem,4vw,2.8rem); }
    .solution-bc-band p { max-width: 640px; margin: 0 auto; opacity: 0.85; }

    /* Benefits — 2 col */
    .benefits-bc h2 { text-align: center; margin-bottom: 44px; }
    .benefits-bc-list { max-width: 740px; margin: 0 auto; }
    .benefit-row {
      display: flex; align-items: flex-start; gap: 20px;
      padding: 24px 0;
      border-bottom: 1px solid var(--border-light);
    }
    .benefit-row:nth-child(even) { background: var(--surface); padding: 24px 16px; border-radius: var(--radius-sm); border-bottom: none; }
    .benefit-check { font-size: 1.5rem; color: var(--brand-primary); flex-shrink: 0; margin-top: 2px; }
    .benefit-text { font-size: 1.05rem; }

    /* Proof */
    .proof-bc h2 { text-align: center; margin-bottom: 44px; }
    .proof-bc-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 28px; }
    .testimonial-bc {
      padding: 32px;
      border-radius: var(--radius-md);
      background: var(--brand-bg);
      box-shadow: var(--shadow-md);
    }
    .testimonial-bc .stars { color: var(--brand-accent); font-size: 1.2rem; letter-spacing: 2px; margin-bottom: 14px; }
    .testimonial-bc .text { margin-bottom: 20px; opacity: 0.85; font-style: italic; line-height: 1.7; }
    .testimonial-bc .author-row { display: flex; align-items: center; gap: 14px; }
    .testimonial-bc .avatar-circle {
      width: 48px; height: 48px; border-radius: 50%;
      background: var(--brand-primary-light); display: flex; align-items: center; justify-content: center;
      font-weight: 700; color: var(--brand-primary); font-size: 1.1rem;
    }
    .testimonial-bc .author-name { font-weight: 600; font-size: 0.95rem; }
    .testimonial-bc .author-role { font-size: 0.8rem; opacity: 0.6; }

    /* FAQ */
    .faq-bc .faq-question { padding: 20px 24px; background: var(--surface); border-radius: var(--radius-sm); margin-bottom: 8px; }
    .faq-bc .faq-item.open .faq-question { background: var(--brand-primary); color: #fff; }
    .faq-bc .faq-item.open .faq-icon { color: #fff; }
    .faq-bc .faq-answer-inner { padding: 16px 24px 24px; }
    .faq-bc h2 { text-align: center; margin-bottom: 36px; }
    .faq-bc .faq-list { max-width: 720px; margin: 0 auto; }

    /* Final CTA */
    .final-cta-bc { text-align: center; padding: 100px 0; }
    .final-cta-bc h2 { margin-bottom: 16px; }
    .final-cta-bc .sub { max-width: 560px; margin: 0 auto 28px; opacity: 0.8; }
    .final-cta-bc .countdown {
      display: inline-flex; gap: 12px; margin-bottom: 32px;
      font-family: var(--heading-font); font-weight: 800; font-size: 1.8rem;
    }
    .final-cta-bc .countdown span {
      background: rgba(255,255,255,0.15); padding: 12px 16px;
      border-radius: var(--radius-sm); min-width: 56px; text-align: center;
    }

    /* Form dark */
    .form-dark { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: var(--radius-md); padding: 36px; max-width: 440px; margin: 0 auto; }
    .form-dark label { color: #fff; }
    .form-dark input { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.2); color: #fff; }
    .form-dark input::placeholder { color: rgba(255,255,255,0.5); }
    .form-dark h3 { color: #fff; text-align: center; margin-bottom: 8px; }
    .form-dark .form-sub { color: rgba(255,255,255,0.7); text-align: center; margin-bottom: 20px; }

    /* Comparison */
    .comparison-table th, .comparison-table td { padding: 14px 20px; text-align: center; border-bottom: 1px solid var(--border-light); }
    .comparison-table th { font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.06em; opacity: 0.6; }
    .comparison-table td:first-child { text-align: left; font-weight: 500; }
    .comparison-table { width: 100%; border-collapse: collapse; max-width: 700px; margin: 32px auto 0; }
    .check-yes { color: var(--brand-primary); font-weight: 700; font-size: 1.2rem; }
    .check-no { color: #ef4444; font-weight: 700; font-size: 1.2rem; }

    /* Process */
    .process-steps-bc { display: grid; grid-template-columns: repeat(3, 1fr); gap: 32px; margin-top: 40px; }
    .step-bc { text-align: center; padding: 28px; }
    .step-bc .num { display: inline-flex; align-items: center; justify-content: center; width: 52px; height: 52px; border-radius: 50%; background: var(--brand-primary); color: #fff; font-weight: 800; font-size: 1.2rem; margin-bottom: 16px; }
    .step-bc h3 { margin-bottom: 10px; }
    .step-bc p { font-size: 0.95rem; opacity: 0.75; }

    @media (max-width: 768px) {
      .lp-section-bc { padding: 52px 0; }
      .hero-bc { padding: 64px 0 44px; }
      .problem-bc-grid { grid-template-columns: 1fr; }
      .problem-bc-grid .icon-block { display: none; }
      .proof-bc-grid { grid-template-columns: 1fr; }
      .trust-strip-bc { gap: 20px; }
      .process-steps-bc { grid-template-columns: 1fr; gap: 20px; }
    }
    @media (max-width: 480px) {
      .lp-section-bc { padding: 40px 0; }
      .hero-bc { padding: 48px 0 32px; }
      .form-dark { padding: 24px 16px; }
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
  const bgCycle = ['bg-white', 'bg-light']
  let bgIdx = 0
  const nextBg = () => { const b = bgCycle[bgIdx % bgCycle.length]; bgIdx++; return b }

  for (const section of sorted) {
    const c = section.content
    switch (section.type) {
      case 'hero': {
        const headline = esc(cf(c, 'headline', ''))
        const subheadline = esc(cf(c, 'subheadline', ''))
        const cta = esc(cf(c, 'cta', offer.primary_cta || 'Get Started'))
        html += `
          <section class="lp-section-bc hero-bc bg-dark" id="s-${section.id}">
            <div class="container text-center">
              <h1>${headline}</h1>
              <p class="sub">${subheadline}</p>
              <a href="#cta-form" class="btn btn-primary btn-large">${cta}</a>
              <p class="hero-urgency-line">\u26A1 Limited availability &mdash; Act now</p>
            </div>
          </section>`
        break
      }
      case 'urgency_bar': {
        const text = esc(cf(c, 'text', ''))
        html += `<div class="urgency-bar-bc" role="alert">${text}</div>`
        break
      }
      case 'trust_strip': {
        const items = cf<string[]>(c, 'items', [])
        html += `
          <div class="lp-section-bc ${nextBg()}">
            <div class="container">
              <div class="trust-strip-bc">
                ${items.map(item => `<div class="trust-stat"><span class="num">${esc(item)}</span></div>`).join('')}
              </div>
            </div>
          </div>`
        break
      }
      case 'problem': {
        const headline = esc(cf(c, 'headline', ''))
        const content = esc(cf(c, 'content', ''))
        html += `
          <section class="lp-section-bc ${nextBg()}" id="s-${section.id}">
            <div class="container">
              <div class="problem-bc-grid">
                <div>
                  ${headline ? `<h2>${headline}</h2>` : ''}
                  ${content.split('\n').filter(Boolean).map(p => `<p>${p}</p>`).join('')}
                </div>
                <div class="icon-block" aria-hidden="true">\u26A0</div>
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
          <section class="lp-section-bc solution-bc-band bg-primary" id="s-${section.id}" style="padding:80px 0">
            <div class="container text-center">
              <h2>${headline}</h2>
              ${content ? `<p>${content}</p>` : ''}
              ${steps.length ? `
                <div class="process-steps-bc" style="margin-top:40px">
                  ${steps.map((s, i) => `
                    <div class="step-bc">
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
          <section class="lp-section-bc benefits-bc ${nextBg()}" id="s-${section.id}">
            <div class="container">
              ${headline ? `<h2>${headline}</h2>` : ''}
              <div class="benefits-bc-list">
                ${items.map(item => `
                  <div class="benefit-row">
                    <span class="benefit-check">\u2713</span>
                    <span class="benefit-text">${esc(item)}</span>
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
          <section class="lp-section-bc proof-bc ${nextBg()}" id="s-${section.id}">
            <div class="container">
              ${headline ? `<h2>${headline}</h2>` : ''}
              <div class="proof-bc-grid">
                ${items.map((item, i) => {
                  const initials = item.length > 0 ? item.charAt(0).toUpperCase() : '?'
                  return `
                    <div class="testimonial-bc">
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
          <section class="lp-section-bc faq-bc ${nextBg()}" id="s-${section.id}">
            <div class="container">
              <h2>${headline}</h2>
              <div class="faq-list" role="list">
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
        const cta = esc(cf(c, 'cta', offer.primary_cta || 'Get Started'))
        html += `
          <section class="lp-section-bc final-cta-bc bg-dark" id="cta-form">
            <div class="container text-center">
              <h2>${headline}</h2>
              ${subheadline ? `<p class="sub">${subheadline}</p>` : ''}
              <div class="countdown" aria-label="Limited time">
                <span>24</span><span>:</span><span>00</span><span>:</span><span>00</span>
              </div>
              ${renderForm(offer, undefined, 'dark')}
              <p style="margin-top:16px;font-size:0.85rem;opacity:0.5">\u{1F512} Your information is secure and will never be shared.</p>
            </div>
          </section>`
        break
      }
      case 'form': {
        html += `
          <section class="lp-section-bc bg-dark" id="cta-form">
            <div class="container">${renderForm(offer, c, 'dark')}</div>
          </section>`
        break
      }
      case 'comparison': {
        const headline = esc(cf(c, 'headline', ''))
        const clientLabel = esc(cf(c, 'client_name', clientName))
        const compItems = cf<{ feature: string; client: boolean; competitor: boolean }[]>(c, 'items', [])
        html += `
          <section class="lp-section-bc ${nextBg()}" id="s-${section.id}">
            <div class="container text-center">
              ${headline ? `<h2>${headline}</h2>` : ''}
              <table class="comparison-table">
                <thead><tr><th></th><th>${clientLabel}</th><th>Others</th></tr></thead>
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
          </section>`
        break
      }
      case 'process_steps': {
        const headline = esc(cf(c, 'headline', ''))
        const steps = cf<{ number: number; title: string; description: string }[]>(c, 'steps', [])
        html += `
          <section class="lp-section-bc ${nextBg()}" id="s-${section.id}">
            <div class="container text-center">
              ${headline ? `<h2>${headline}</h2>` : ''}
              <div class="process-steps-bc">
                ${steps.map(s => `
                  <div class="step-bc">
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
// =========================================================================

function gapPlayCSS(): string {
  return `
    /* Gap Play — editorial, story-driven, comparison-heavy */
    .lp-section-gp { padding: 72px 0; }
    .lp-section-gp:nth-child(even) { background: var(--surface); }

    /* Hero */
    .hero-gp { padding: 100px 0 72px; }
    .hero-gp h1 {
      font-size: clamp(2.2rem, 5.5vw, 3.8rem);
      font-weight: 900;
      letter-spacing: -0.03em;
      margin-bottom: 20px;
      max-width: 820px;
    }
    .hero-gp .sub {
      font-size: clamp(1.05rem,1.3vw,1.3rem);
      opacity: 0.7;
      max-width: 600px;
      margin-bottom: 36px;
      line-height: 1.7;
    }
    .hero-gp .eyebrow {
      display: inline-block;
      font-size: 0.8rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--brand-primary);
      margin-bottom: 16px;
    }

    /* Problem — comparison table */
    .comparison-gp h2 { margin-bottom: 32px; }
    .comparison-gp-table { width: 100%; border-collapse: collapse; max-width: 740px; }
    .comparison-gp-table thead th {
      padding: 16px 20px;
      font-size: 0.85rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      border-bottom: 2px solid var(--brand-primary);
    }
    .comparison-gp-table thead th:first-child { text-align: left; }
    .comparison-gp-table thead th:nth-child(2) { color: var(--brand-primary); }
    .comparison-gp-table thead th:nth-child(3) { opacity: 0.5; }
    .comparison-gp-table td { padding: 16px 20px; border-bottom: 1px solid var(--border-light); text-align: center; }
    .comparison-gp-table td:first-child { text-align: left; font-weight: 500; }
    .gp-yes { color: var(--brand-primary); font-size: 1.3rem; font-weight: 700; }
    .gp-no { color: #dc2626; font-size: 1.3rem; font-weight: 700; }

    /* Solution — numbered process */
    .process-gp { position: relative; max-width: 680px; }
    .process-gp::before {
      content: ''; position: absolute; left: 27px; top: 12px; bottom: 12px;
      width: 3px; background: linear-gradient(to bottom, var(--brand-primary), var(--brand-accent));
      border-radius: 3px;
    }
    .process-gp h2 { margin-bottom: 40px; }
    .process-gp-item { display: flex; gap: 24px; align-items: flex-start; margin-bottom: 36px; position: relative; }
    .process-gp-num {
      flex-shrink: 0; width: 56px; height: 56px; border-radius: 50%;
      background: var(--brand-primary); color: #fff;
      display: flex; align-items: center; justify-content: center;
      font-weight: 800; font-size: 1.2rem; position: relative; z-index: 1;
      box-shadow: 0 0 0 6px var(--brand-bg);
    }
    .process-gp-body h3 { font-size: 1.15rem; margin-bottom: 8px; }
    .process-gp-body p { opacity: 0.75; line-height: 1.7; }

    /* Benefits — editorial list */
    .benefits-gp h2 { margin-bottom: 40px; }
    .benefit-gp-item { margin-bottom: 28px; padding-bottom: 28px; border-bottom: 1px solid var(--border-light); max-width: 680px; }
    .benefit-gp-item:last-child { border-bottom: none; }
    .benefit-gp-item h3 { font-size: 1.1rem; margin-bottom: 8px; display: flex; align-items: center; gap: 10px; }
    .benefit-gp-item h3::before { content: '\u2713'; color: var(--brand-primary); font-size: 1.2rem; font-weight: 700; }
    .benefit-gp-item p { opacity: 0.75; line-height: 1.7; padding-left: 30px; }

    /* Proof — case study */
    .proof-gp h2 { margin-bottom: 40px; }
    .case-study { margin-bottom: 32px; border: 1px solid var(--border-light); border-radius: var(--radius-md); overflow: hidden; }
    .case-study-header { padding: 20px 24px; background: var(--surface); font-weight: 700; font-size: 0.95rem; border-bottom: 1px solid var(--border-light); }
    .case-study-body { display: grid; grid-template-columns: repeat(3, 1fr); }
    .case-study-cell { padding: 24px; }
    .case-study-cell:not(:last-child) { border-right: 1px solid var(--border-light); }
    .case-study-label { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.06em; opacity: 0.5; margin-bottom: 8px; font-weight: 700; }
    .case-study-cell p { font-size: 0.95rem; line-height: 1.6; }

    /* FAQ — editorial Q&A */
    .faq-gp h2 { margin-bottom: 36px; }
    .faq-gp .faq-list { max-width: 700px; }
    .faq-gp .faq-question { font-size: 1.05rem; padding: 20px 0; }
    .faq-gp .faq-answer-inner { padding: 0 0 20px; line-height: 1.75; }

    /* Final CTA */
    .final-cta-gp { padding: 100px 0; background: var(--surface); }
    .final-cta-gp h2 { margin-bottom: 16px; max-width: 640px; }
    .final-cta-gp .sub { opacity: 0.7; max-width: 540px; margin-bottom: 32px; }

    /* Form */
    .lp-form-gp { max-width: 420px; padding: 36px; background: var(--brand-bg); border-radius: var(--radius-md); box-shadow: var(--shadow-md); }
    .lp-form-gp h3 { margin-bottom: 8px; }
    .lp-form-gp .form-sub { margin-bottom: 20px; font-size: 0.95rem; opacity: 0.7; }

    /* Urgency / trust */
    .urgency-bar-gp { background: var(--brand-text); color: var(--brand-bg); text-align: center; padding: 14px 24px; font-weight: 700; font-size: 0.9rem; letter-spacing: 0.03em; }
    .trust-strip-gp { display: flex; align-items: center; gap: 32px; flex-wrap: wrap; padding: 24px 0; font-size: 0.9rem; font-weight: 600; opacity: 0.55; }

    @media (max-width: 768px) {
      .lp-section-gp { padding: 52px 0; }
      .hero-gp { padding: 64px 0 48px; }
      .case-study-body { grid-template-columns: 1fr; }
      .case-study-cell:not(:last-child) { border-right: none; border-bottom: 1px solid var(--border-light); }
      .comparison-gp-table th, .comparison-gp-table td { padding: 12px 10px; font-size: 0.9rem; }
    }
    @media (max-width: 480px) {
      .lp-section-gp { padding: 40px 0; }
      .hero-gp { padding: 48px 0 36px; }
      .lp-form-gp { padding: 24px 16px; }
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
          <section class="lp-section-gp hero-gp" id="s-${section.id}">
            <div class="container">
              <span class="eyebrow">The Smarter Approach</span>
              <h1>${headline}</h1>
              <p class="sub">${subheadline}</p>
              <a href="#cta-form" class="btn btn-primary btn-large">${cta}</a>
            </div>
          </section>`
        break
      }
      case 'problem': {
        const headline = esc(cf(c, 'headline', ''))
        const content = esc(cf(c, 'content', ''))
        html += `
          <section class="lp-section-gp" id="s-${section.id}">
            <div class="container">
              ${headline ? `<h2>${headline}</h2>` : ''}
              <div style="max-width:680px">
                ${content.split('\n').filter(Boolean).map(p => `<p style="margin-bottom:16px;opacity:0.85;line-height:1.75">${p}</p>`).join('')}
              </div>
            </div>
          </section>`
        break
      }
      case 'comparison': {
        const headline = esc(cf(c, 'headline', ''))
        const clientLabel = esc(cf(c, 'client_name', clientName))
        const compItems = cf<{ feature: string; client: boolean; competitor: boolean }[]>(c, 'items', [])
        html += `
          <section class="lp-section-gp comparison-gp" id="s-${section.id}">
            <div class="container">
              ${headline ? `<h2>${headline}</h2>` : ''}
              <table class="comparison-gp-table">
                <thead><tr><th>Feature</th><th>${clientLabel}</th><th>Typical Provider</th></tr></thead>
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
          </section>`
        break
      }
      case 'solution': {
        const headline = esc(cf(c, 'headline', ''))
        const steps = cf<{ title: string; description: string }[]>(c, 'steps', [])
        const content = esc(cf(c, 'content', ''))
        html += `
          <section class="lp-section-gp" id="s-${section.id}">
            <div class="container">
              <div class="process-gp">
                ${headline ? `<h2>${headline}</h2>` : ''}
                ${content && !steps.length ? `<p style="margin-bottom:32px;opacity:0.8;max-width:600px">${content}</p>` : ''}
                ${steps.map((s, i) => `
                  <div class="process-gp-item">
                    <div class="process-gp-num">${i + 1}</div>
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
      case 'process_steps': {
        const headline = esc(cf(c, 'headline', ''))
        const steps = cf<{ number: number; title: string; description: string }[]>(c, 'steps', [])
        html += `
          <section class="lp-section-gp" id="s-${section.id}">
            <div class="container">
              <div class="process-gp">
                ${headline ? `<h2>${headline}</h2>` : ''}
                ${steps.map(s => `
                  <div class="process-gp-item">
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
      case 'benefits': {
        const headline = esc(cf(c, 'headline', ''))
        const items = cf<string[]>(c, 'items', [])
        html += `
          <section class="lp-section-gp benefits-gp" id="s-${section.id}">
            <div class="container">
              ${headline ? `<h2>${headline}</h2>` : ''}
              ${items.map(item => {
                // Split on first period or dash to get headline/body
                const parts = item.split(/[:\u2014\u2013]/)
                const title = parts[0]?.trim() || item
                const body = parts.slice(1).join(' ').trim()
                return `
                  <div class="benefit-gp-item">
                    <h3>${esc(title)}</h3>
                    ${body ? `<p>${esc(body)}</p>` : `<p>${esc(item)}</p>`}
                  </div>`
              }).join('')}
            </div>
          </section>`
        break
      }
      case 'proof': {
        const headline = esc(cf(c, 'headline', ''))
        const items = cf<string[]>(c, 'items', [])
        html += `
          <section class="lp-section-gp proof-gp" id="s-${section.id}">
            <div class="container">
              ${headline ? `<h2>${headline}</h2>` : ''}
              ${items.map((item, i) => `
                <div class="case-study">
                  <div class="case-study-header">Case Study #${i + 1}</div>
                  <div class="case-study-body">
                    <div class="case-study-cell">
                      <div class="case-study-label">Scenario</div>
                      <p>${esc(item)}</p>
                    </div>
                    <div class="case-study-cell">
                      <div class="case-study-label">Action</div>
                      <p>Chose ${esc(clientName)}</p>
                    </div>
                    <div class="case-study-cell">
                      <div class="case-study-label">Result</div>
                      <p>Transformed their outcome</p>
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          </section>`
        break
      }
      case 'faq': {
        const headline = esc(cf(c, 'headline', 'Common Questions'))
        const items = cf<{ question: string; answer: string }[]>(c, 'items', [])
        html += `
          <section class="lp-section-gp faq-gp" id="s-${section.id}">
            <div class="container">
              <h2>${headline}</h2>
              <div class="faq-list" role="list">
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
        const cta = esc(cf(c, 'cta', offer.primary_cta || 'Get Started'))
        html += `
          <section class="lp-section-gp final-cta-gp" id="cta-form">
            <div class="container">
              <h2>${headline}</h2>
              ${subheadline ? `<p class="sub">${subheadline}</p>` : ''}
              <a href="#cta-form" class="btn btn-primary btn-large">${cta}</a>
            </div>
          </section>`
        break
      }
      case 'form': {
        html += `
          <section class="lp-section-gp" id="cta-form">
            <div class="container">
              <div class="lp-form-gp">${renderForm(offer, c)}</div>
            </div>
          </section>`
        break
      }
      case 'urgency_bar': {
        const text = esc(cf(c, 'text', ''))
        html += `<div class="urgency-bar-gp" role="alert">${text}</div>`
        break
      }
      case 'trust_strip': {
        const items = cf<string[]>(c, 'items', [])
        html += `
          <div class="lp-section-gp" style="padding:28px 0">
            <div class="container"><div class="trust-strip-gp">${items.map(i => `<span>${esc(i)}</span>`).join('')}</div></div>
          </div>`
        break
      }
    }
  }
  return html
}

// =========================================================================
// TEMPLATE 4 — Aggressive DR
// =========================================================================

function aggressiveDrCSS(): string {
  return `
    /* Aggressive DR — max density, multiple CTAs, action-oriented */
    .lp-section-dr { padding: 72px 0; }
    .lp-section-dr:nth-child(even) { background: var(--surface); }

    /* Hero — everything above fold */
    .hero-dr { padding: 80px 0 48px; text-align: center; }
    .hero-dr h1 {
      font-size: clamp(2.2rem, 5.5vw, 3.6rem);
      font-weight: 900; letter-spacing: -0.02em;
      margin-bottom: 16px; max-width: 880px; margin-left: auto; margin-right: auto;
    }
    .hero-dr .sub { font-size: clamp(1.05rem,1.3vw,1.25rem); opacity: 0.75; max-width: 640px; margin: 0 auto 28px; }
    .hero-dr .cta-row { display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; margin-bottom: 24px; }
    .hero-trust-bar {
      display: flex; align-items: center; justify-content: center;
      gap: 20px; flex-wrap: wrap; font-size: 0.85rem; opacity: 0.6; margin-top: 16px;
    }
    .hero-trust-bar span { display: flex; align-items: center; gap: 6px; }
    .hero-trust-bar span::before { content: '\u2713'; color: var(--brand-primary); font-weight: 700; }

    /* Urgency bar */
    .urgency-bar-dr {
      background: linear-gradient(90deg, #dc2626, #ef4444);
      color: #fff; text-align: center; padding: 16px 24px;
      font-weight: 800; font-size: clamp(0.9rem,1.1vw,1.05rem);
      letter-spacing: 0.03em; text-transform: uppercase;
      animation: pulse-urgency 2s ease-in-out infinite;
    }
    @keyframes pulse-urgency {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.85; }
    }

    /* Benefits — stacked blocks */
    .benefits-dr h2 { text-align: center; margin-bottom: 40px; }
    .benefits-dr-list { max-width: 720px; margin: 0 auto; }
    .benefit-dr-block {
      display: grid; grid-template-columns: 64px 1fr; gap: 20px;
      padding: 28px 0; border-bottom: 1px solid var(--border-light);
      align-items: start;
    }
    .benefit-dr-block:nth-child(even) { direction: ltr; }
    .benefit-dr-icon {
      width: 52px; height: 52px; border-radius: var(--radius-sm);
      background: var(--brand-primary-light); color: var(--brand-primary);
      display: flex; align-items: center; justify-content: center;
      font-size: 1.4rem; font-weight: 700;
    }
    .benefit-dr-text h3 { font-size: 1.05rem; margin-bottom: 6px; }
    .benefit-dr-text p { font-size: 0.95rem; opacity: 0.75; }

    /* Inline CTA banner */
    .inline-cta {
      text-align: center; padding: 40px 24px;
      background: linear-gradient(135deg, var(--brand-primary), var(--brand-secondary));
      color: #fff;
    }
    .inline-cta p { font-size: 1.15rem; font-weight: 600; margin-bottom: 20px; color: #fff; }
    .inline-cta .btn { background: #fff; color: var(--brand-primary); }
    .inline-cta .btn:hover { background: #f3f4f6; }

    /* Proof — stacked formats */
    .proof-dr h2 { text-align: center; margin-bottom: 36px; }
    .stats-row {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px;
      margin-bottom: 40px;
    }
    .stat-box {
      text-align: center; padding: 28px 16px;
      background: var(--brand-bg); border-radius: var(--radius-md);
      box-shadow: var(--shadow-sm);
    }
    .stat-box .num {
      font-size: clamp(2rem,3.5vw,3rem); font-weight: 900;
      font-family: var(--heading-font); color: var(--brand-primary);
      display: block;
    }
    .stat-box .lbl { font-size: 0.85rem; opacity: 0.6; margin-top: 4px; }
    .testimonials-dr { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px; margin-bottom: 32px; }
    .testimonial-dr {
      padding: 28px; border-radius: var(--radius-md);
      background: var(--brand-bg); box-shadow: var(--shadow-sm);
      border-left: 4px solid var(--brand-primary);
    }
    .testimonial-dr .stars { color: var(--brand-accent); font-size: 1rem; letter-spacing: 2px; margin-bottom: 12px; }
    .testimonial-dr .text { font-style: italic; margin-bottom: 14px; opacity: 0.85; line-height: 1.65; }
    .testimonial-dr .author { font-weight: 600; font-size: 0.9rem; }
    .logo-strip-dr { display: flex; align-items: center; justify-content: center; gap: 36px; flex-wrap: wrap; padding: 24px 0; opacity: 0.4; font-size: 0.85rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; }

    /* Problem — fear/warning */
    .problem-dr { border-left: 4px solid #dc2626; }
    .problem-dr-inner { padding-left: 28px; max-width: 700px; }
    .problem-dr h2 { color: #dc2626; margin-bottom: 20px; }
    .problem-dr .warning-icon { font-size: 2rem; margin-bottom: 16px; display: block; }
    .problem-dr p { margin-bottom: 14px; opacity: 0.85; line-height: 1.7; }

    /* Solution — steps with CTAs */
    .solution-dr h2 { text-align: center; margin-bottom: 40px; }
    .solution-steps-dr { max-width: 680px; margin: 0 auto; }
    .step-dr {
      display: grid; grid-template-columns: 60px 1fr; gap: 20px;
      margin-bottom: 32px; align-items: start;
    }
    .step-dr-num {
      width: 52px; height: 52px; border-radius: 50%;
      background: var(--brand-primary); color: #fff;
      display: flex; align-items: center; justify-content: center;
      font-weight: 800; font-size: 1.1rem;
    }
    .step-dr-body h3 { margin-bottom: 8px; font-size: 1.1rem; }
    .step-dr-body p { opacity: 0.75; line-height: 1.65; margin-bottom: 16px; }
    .step-dr-cta { margin-top: 24px; text-align: center; }

    /* FAQ — objection crusher */
    .faq-dr h2 { text-align: center; margin-bottom: 36px; }
    .faq-dr .faq-list { max-width: 720px; margin: 0 auto; }
    .faq-dr .faq-question {
      padding: 18px 20px;
      background: var(--surface);
      border-radius: var(--radius-sm);
      margin-bottom: 6px;
      font-weight: 700;
    }
    .faq-dr .faq-item.open .faq-question { background: var(--brand-primary); color: #fff; }
    .faq-dr .faq-item.open .faq-icon { color: #fff; }
    .faq-dr .faq-answer-inner { padding: 16px 20px 20px; line-height: 1.7; }

    /* Final CTA */
    .final-cta-dr { text-align: center; padding: 100px 0; background: #111827; color: #f3f4f6; }
    .final-cta-dr h2 { color: #fff; margin-bottom: 12px; }
    .final-cta-dr .sub { color: rgba(255,255,255,0.7); max-width: 560px; margin: 0 auto 20px; }
    .final-cta-dr .urgency-text { color: var(--brand-accent); font-weight: 700; font-size: 0.95rem; margin-bottom: 28px; }
    .final-cta-dr .cta-row { display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; }
    .final-cta-dr .secondary-link { color: rgba(255,255,255,0.6); font-size: 0.9rem; margin-top: 16px; display: inline-block; text-decoration: underline; }

    /* Form dark variant for DR */
    .form-dark { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: var(--radius-md); padding: 36px; max-width: 440px; margin: 0 auto; }
    .form-dark label { color: #fff; }
    .form-dark input { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.2); color: #fff; }
    .form-dark input::placeholder { color: rgba(255,255,255,0.5); }
    .form-dark h3 { color: #fff; text-align: center; margin-bottom: 8px; }
    .form-dark .form-sub { color: rgba(255,255,255,0.7); text-align: center; margin-bottom: 20px; }

    /* Comparison */
    .comparison-table { width: 100%; border-collapse: collapse; max-width: 700px; margin: 32px auto 0; }
    .comparison-table th, .comparison-table td { padding: 14px 20px; text-align: center; border-bottom: 1px solid var(--border-light); }
    .comparison-table th { font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.06em; opacity: 0.6; }
    .comparison-table td:first-child { text-align: left; font-weight: 500; }
    .check-yes { color: var(--brand-primary); font-weight: 700; font-size: 1.2rem; }
    .check-no { color: #ef4444; font-weight: 700; font-size: 1.2rem; }

    /* Trust strip */
    .trust-strip-dr { display: flex; align-items: center; justify-content: center; gap: 28px; flex-wrap: wrap; padding: 24px 0; font-size: 0.9rem; font-weight: 600; opacity: 0.6; }

    @media (max-width: 768px) {
      .lp-section-dr { padding: 52px 0; }
      .hero-dr { padding: 56px 0 36px; }
      .stats-row { grid-template-columns: 1fr; gap: 16px; }
      .testimonials-dr { grid-template-columns: 1fr; }
      .step-dr { grid-template-columns: 48px 1fr; }
      .benefit-dr-block { grid-template-columns: 48px 1fr; }
    }
    @media (max-width: 480px) {
      .lp-section-dr { padding: 40px 0; }
      .hero-dr { padding: 40px 0 28px; }
      .hero-dr .cta-row { flex-direction: column; align-items: center; }
      .final-cta-dr { padding: 60px 0; }
      .form-dark { padding: 24px 16px; }
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
  const ctaText = esc(offer.primary_cta || 'Get Started Now')
  let sectionCount = 0

  // Insert inline CTA after every N content sections
  const maybeInlineCta = () => {
    sectionCount++
    if (sectionCount % 3 === 0) {
      html += `
        <div class="inline-cta">
          <p>Ready to take the next step?</p>
          <a href="#cta-form" class="btn btn-large">${ctaText}</a>
        </div>`
    }
  }

  for (const section of sorted) {
    const c = section.content
    switch (section.type) {
      case 'hero': {
        const headline = esc(cf(c, 'headline', ''))
        const subheadline = esc(cf(c, 'subheadline', ''))
        const cta = esc(cf(c, 'cta', offer.primary_cta || 'Get Started Now'))
        const trustItems = cf<string[]>(c, 'trust_items', [])
        html += `
          <section class="lp-section-dr hero-dr" id="s-${section.id}">
            <div class="container">
              <h1>${headline}</h1>
              <p class="sub">${subheadline}</p>
              <div class="cta-row">
                <a href="#cta-form" class="btn btn-primary btn-large">${cta}</a>
                <a href="#cta-form" class="btn btn-secondary btn-large">Learn More \u2193</a>
              </div>
              ${trustItems.length ? `<div class="hero-trust-bar">${trustItems.map(t => `<span>${esc(t)}</span>`).join('')}</div>` : ''}
            </div>
          </section>`
        break
      }
      case 'urgency_bar': {
        const text = esc(cf(c, 'text', ''))
        html += `<div class="urgency-bar-dr" role="alert">\u26A0 ${text}</div>`
        break
      }
      case 'trust_strip': {
        const items = cf<string[]>(c, 'items', [])
        html += `
          <div class="lp-section-dr" style="padding:28px 0">
            <div class="container"><div class="trust-strip-dr">${items.map(i => `<span>${esc(i)}</span>`).join('')}</div></div>
          </div>`
        break
      }
      case 'benefits': {
        const headline = esc(cf(c, 'headline', ''))
        const items = cf<string[]>(c, 'items', [])
        html += `
          <section class="lp-section-dr benefits-dr" id="s-${section.id}">
            <div class="container">
              ${headline ? `<h2>${headline}</h2>` : ''}
              <div class="benefits-dr-list">
                ${items.map((item, i) => `
                  <div class="benefit-dr-block">
                    <div class="benefit-dr-icon">\u2713</div>
                    <div class="benefit-dr-text">
                      <h3>Benefit #${i + 1}</h3>
                      <p>${esc(item)}</p>
                    </div>
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
        // Stats row (generated placeholders if no explicit stats)
        html += `
          <section class="lp-section-dr proof-dr" id="s-${section.id}">
            <div class="container">
              ${headline ? `<h2>${headline}</h2>` : ''}
              <div class="stats-row">
                <div class="stat-box"><span class="num">500+</span><span class="lbl">Happy Clients</span></div>
                <div class="stat-box"><span class="num">98%</span><span class="lbl">Satisfaction Rate</span></div>
                <div class="stat-box"><span class="num">10+</span><span class="lbl">Years Experience</span></div>
              </div>
              <div class="testimonials-dr">
                ${items.map(item => `
                  <div class="testimonial-dr">
                    <div class="stars">\u2605\u2605\u2605\u2605\u2605</div>
                    <p class="text">${esc(item)}</p>
                    <p class="author">&mdash; Verified Customer</p>
                  </div>
                `).join('')}
              </div>
              <div class="logo-strip-dr">
                <span>As Seen In</span>
                <span>\u25CF Featured Partner</span>
                <span>\u25CF Industry Leader</span>
                <span>\u25CF Top Rated</span>
              </div>
            </div>
          </section>`
        maybeInlineCta()
        break
      }
      case 'problem': {
        const headline = esc(cf(c, 'headline', 'What Happens If You Do Nothing?'))
        const content = esc(cf(c, 'content', ''))
        html += `
          <section class="lp-section-dr" id="s-${section.id}">
            <div class="container">
              <div class="problem-dr">
                <div class="problem-dr-inner">
                  <span class="warning-icon" aria-hidden="true">\u26A0</span>
                  <h2>${headline}</h2>
                  ${content.split('\n').filter(Boolean).map(p => `<p>${p}</p>`).join('')}
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
          <section class="lp-section-dr" id="s-${section.id}">
            <div class="container">
              ${headline ? `<h2 class="text-center" style="margin-bottom:36px">${headline}</h2>` : ''}
              ${content && !steps.length ? `<p class="text-center" style="max-width:640px;margin:0 auto 32px;opacity:0.8">${content}</p>` : ''}
              <div class="solution-steps-dr">
                ${steps.map((s, i) => `
                  <div class="step-dr">
                    <div class="step-dr-num">${i + 1}</div>
                    <div class="step-dr-body">
                      <h3>${esc(s.title)}</h3>
                      <p>${esc(s.description)}</p>
                    </div>
                  </div>
                  ${(i + 1) % 2 === 0 ? `<div class="step-dr-cta"><a href="#cta-form" class="btn btn-primary">${ctaText}</a></div>` : ''}
                `).join('')}
              </div>
            </div>
          </section>`
        break
      }
      case 'process_steps': {
        const headline = esc(cf(c, 'headline', ''))
        const steps = cf<{ number: number; title: string; description: string }[]>(c, 'steps', [])
        html += `
          <section class="lp-section-dr" id="s-${section.id}">
            <div class="container">
              ${headline ? `<h2 class="text-center" style="margin-bottom:36px">${headline}</h2>` : ''}
              <div class="solution-steps-dr">
                ${steps.map((s, i) => `
                  <div class="step-dr">
                    <div class="step-dr-num">${s.number}</div>
                    <div class="step-dr-body">
                      <h3>${esc(s.title)}</h3>
                      <p>${esc(s.description)}</p>
                    </div>
                  </div>
                  ${(i + 1) % 2 === 0 ? `<div class="step-dr-cta"><a href="#cta-form" class="btn btn-primary">${ctaText}</a></div>` : ''}
                `).join('')}
              </div>
            </div>
          </section>`
        break
      }
      case 'faq': {
        const headline = esc(cf(c, 'headline', 'Still Not Convinced?'))
        const items = cf<{ question: string; answer: string }[]>(c, 'items', [])
        html += `
          <section class="lp-section-dr faq-dr" id="s-${section.id}">
            <div class="container">
              <h2>${headline}</h2>
              <div class="faq-list" role="list">
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
        const cta = esc(cf(c, 'cta', offer.primary_cta || 'Get Started Now'))
        html += `
          <section class="lp-section-dr final-cta-dr" id="cta-form">
            <div class="container">
              <h2>${headline}</h2>
              ${subheadline ? `<p class="sub">${subheadline}</p>` : ''}
              <p class="urgency-text">\u23F3 This offer won't last. Don't miss out.</p>
              ${renderForm(offer, undefined, 'dark')}
              <a href="#" class="secondary-link">No thanks, I'll pass on this opportunity</a>
            </div>
          </section>`
        break
      }
      case 'form': {
        html += `
          <section class="lp-section-dr final-cta-dr" id="cta-form">
            <div class="container">${renderForm(offer, c, 'dark')}</div>
          </section>`
        break
      }
      case 'comparison': {
        const headline = esc(cf(c, 'headline', ''))
        const clientLabel = esc(cf(c, 'client_name', clientName))
        const compItems = cf<{ feature: string; client: boolean; competitor: boolean }[]>(c, 'items', [])
        html += `
          <section class="lp-section-dr" id="s-${section.id}">
            <div class="container text-center">
              ${headline ? `<h2>${headline}</h2>` : ''}
              <table class="comparison-table">
                <thead><tr><th></th><th>${clientLabel}</th><th>Others</th></tr></thead>
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

  // Build the header/logo bar
  const headerHtml = logoUrl
    ? `<header style="padding:20px 24px;display:flex;align-items:center;gap:12px">
        <img src="${esc(logoUrl)}" alt="${esc(clientName)} logo" style="height:40px;width:auto">
        <span style="font-family:var(--heading-font);font-weight:700;font-size:1.1rem">${esc(clientName)}</span>
      </header>`
    : `<header style="padding:20px 24px">
        <span style="font-family:var(--heading-font);font-weight:700;font-size:1.1rem">${esc(clientName)}</span>
      </header>`

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
    ${templateCSS}
  </style>
</head>
<body>
  ${headerHtml}
  <main>
    ${bodyHtml}
  </main>
  <footer style="text-align:center;padding:32px 24px;font-size:0.8rem;opacity:0.45">
    &copy; ${new Date().getFullYear()} ${esc(clientName)}. All rights reserved.
  </footer>
  ${SHARED_JS}
</body>
</html>`
}
