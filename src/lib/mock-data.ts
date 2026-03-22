// Mock data used for static export / demo mode
// When Supabase is connected, real data replaces this

import type { Client, Avatar, Offer, IntakeQuestion, CompetitorIntel } from '@/types/database'

export const MOCK_CLIENT: Client = {
  id: 'demo-client-1',
  name: 'RoofCo Exteriors',
  website: 'https://roofcoexteriors.com',
  business_summary: 'RoofCo Exteriors is a full-service residential and commercial roofing company serving the greater Dallas-Fort Worth area. Founded in 2015, they specialize in storm damage repair, full roof replacements, and preventive maintenance. Their team of 45+ certified professionals has completed over 2,300 projects with a 4.9-star rating across 500+ Google reviews.',
  services: 'Residential roof replacement, storm damage repair, roof inspections, gutter installation, commercial roofing, emergency tarping, insurance claim assistance',
  differentiators: 'GAF Master Elite certified (top 3% of contractors nationwide), 24/7 emergency response team, full insurance claim management, lifetime workmanship warranty, drone-assisted inspections',
  trust_signals: 'GAF Master Elite Certified, BBB A+ Rating, 2,300+ completed projects, 4.9 stars on Google (500+ reviews), Licensed and fully insured, 8+ years in business',
  tone: 'Professional, reassuring, authoritative. Speak with confidence but empathy.',
  ad_copy_rules: {
    tone_descriptors: ['professional', 'reassuring', 'authoritative', 'empathetic'],
    banned_words: ['cheap', 'guarantee', 'best', '#1', 'act now'],
    required_disclaimers: ['Licensed and insured', 'Results may vary'],
    platform_rules: {
      google: { headline_max_chars: 30, description_max_chars: 90 },
      meta: { primary_text_max_chars: 125, headline_max_chars: 40 },
      youtube: {},
    },
    brand_constraints: 'Never use all caps. Always include company name in first headline.',
    compliance_notes: 'No income claims. No before/after photos without consent.',
  },
  ad_copy_notes: 'Focus on the free inspection offer as the primary hook. Emphasize the insurance claim assistance.',
  competitors: [
    { name: 'StormGuard Roofing', website: 'https://stormguardroofing.com', notes: 'Largest competitor. Heavy Meta ad spend.' },
    { name: 'DFW Roof Pros', website: 'https://dfwroofpros.com', notes: 'Lower prices, aggressive discounting.' },
    { name: 'Apex Restoration', website: 'https://apexrestoration.com', notes: 'Premium positioning.' },
  ],
  intake_status: 'pending',
  created_at: '2026-03-01T00:00:00Z',
  updated_at: '2026-03-22T00:00:00Z',
}

export const MOCK_AVATARS: Avatar[] = [
  {
    id: 'avatar-1', client_id: 'demo-client-1', name: 'Storm-Damage Homeowner', avatar_type: 'homeowner',
    description: 'Homeowners who have recently experienced storm damage and need immediate inspection and repair.',
    pain_points: 'Visible roof damage after storms, fear of leaks, confusion about insurance claims, worry about choosing a trustworthy contractor',
    motivations: 'Protect their home, get roof fixed quickly, minimize out-of-pocket costs through insurance',
    objections: 'Worried about cost, unsure if they have damage, fear of being scammed by storm chasers',
    desired_outcome: 'A fully repaired roof covered by insurance with zero hassle',
    trigger_events: 'Major storm, neighbor getting roof replaced, visible damage spotted',
    messaging_style: 'Reassuring and empathetic — they\'re stressed about damage and cost',
    preferred_platforms: ['meta', 'google'], recommended_angles: ['problem', 'fear', 'mechanism'],
    status: 'approved', created_at: '2026-03-01T00:00:00Z', updated_at: '2026-03-01T00:00:00Z',
  },
  {
    id: 'avatar-2', client_id: 'demo-client-1', name: 'Proactive Homeowner', avatar_type: 'homeowner',
    description: 'Homeowners with aging roofs who want to get ahead of problems.',
    pain_points: 'Aging roof showing wear, worried about sudden failure, unsure when to replace',
    motivations: 'Prevent costly emergency repairs, increase home value, peace of mind',
    objections: 'Not sure if they need a new roof yet, concerned about cost, bad timing',
    desired_outcome: 'A modern, durable roof installed on their timeline with fair pricing',
    trigger_events: 'Roof hitting 15-year mark, neighbors replacing roofs, home inspection',
    messaging_style: 'Informative and advisory — they\'re planning, not panicking',
    preferred_platforms: ['google', 'youtube'], recommended_angles: ['mechanism', 'cost', 'authority'],
    status: 'approved', created_at: '2026-03-01T00:00:00Z', updated_at: '2026-03-01T00:00:00Z',
  },
  {
    id: 'avatar-3', client_id: 'demo-client-1', name: 'Property Manager', avatar_type: 'property_manager',
    description: 'Property managers overseeing multiple properties who need reliable roofing services.',
    pain_points: 'Managing multiple properties, need fast turnaround, budget constraints',
    motivations: 'Maintain property value, keep tenants satisfied, find one reliable contractor',
    objections: 'Need volume pricing, worried about quality across jobs, scheduling complexity',
    desired_outcome: 'A single trusted roofing partner for all properties',
    trigger_events: 'Annual inspections, tenant complaints, storm damage across units',
    messaging_style: 'Professional and efficient — business-minded, values reliability',
    preferred_platforms: ['google', 'meta'], recommended_angles: ['authority', 'speed', 'cost'],
    status: 'approved', created_at: '2026-03-01T00:00:00Z', updated_at: '2026-03-01T00:00:00Z',
  },
  {
    id: 'avatar-4', client_id: 'demo-client-1', name: 'Insurance-Aware Homeowner', avatar_type: 'homeowner',
    description: 'Homeowners who suspect they may have damage covered by insurance but don\'t know how to navigate claims.',
    pain_points: 'Don\'t understand claims process, worried about rate increases, unsure if damage qualifies',
    motivations: 'Get roof repaired without paying out of pocket, understand their coverage',
    objections: 'Fear filing a claim will raise rates, don\'t trust contractors who push insurance work',
    desired_outcome: 'Successful insurance claim with full coverage and a new roof at minimal cost',
    trigger_events: 'Insurance renewal notice, talking to neighbors about claims, finding a leak',
    messaging_style: 'Educational and trustworthy — demystify the process, reduce anxiety',
    preferred_platforms: ['meta', 'youtube'], recommended_angles: ['mechanism', 'hidden_truth', 'proof'],
    status: 'approved', created_at: '2026-03-01T00:00:00Z', updated_at: '2026-03-01T00:00:00Z',
  },
]

export const MOCK_OFFERS: Offer[] = [
  {
    id: 'offer-1', client_id: 'demo-client-1', name: 'Free Roof Inspection',
    offer_type: 'lead_generation', headline: 'Get a Free Professional Roof Inspection',
    subheadline: 'We inspect, document, and handle your insurance claim — all at no cost',
    description: 'Our certified team inspects your entire roof, documents all findings, and provides a detailed damage report. If damage is found, we handle the full insurance claim.',
    primary_cta: 'Schedule Your Free Inspection', conversion_type: 'lead_form',
    benefits: ['100% free — no cost unless we find claimable damage', 'Full photo documentation', 'Insurance claim management included', 'GAF Master Elite certified inspectors', 'Available within 48 hours'],
    proof_elements: ['2,300+ inspections completed', 'GAF Master Elite certified', '4.9 stars on Google'],
    urgency_elements: ['Storm damage claims must be filed within 12 months', 'Limited inspection slots this week'],
    faq: [{ question: 'Is it really free?', answer: 'Yes — no damage means no cost. If damage exists, we proceed only with your approval.' }],
    landing_page_type: 'lead_capture', status: 'approved',
    created_at: '2026-03-01T00:00:00Z', updated_at: '2026-03-01T00:00:00Z',
  },
  {
    id: 'offer-2', client_id: 'demo-client-1', name: 'Storm Damage Emergency Response',
    offer_type: 'appointment', headline: 'Emergency Roof Repair — Same Day Response',
    subheadline: 'Active leak or visible damage? We\'re on our way.',
    description: 'Same-day tarping, temporary repairs, and full damage assessment. We stabilize immediately then handle permanent repair and insurance claim.',
    primary_cta: 'Call Now for Emergency Service', conversion_type: 'phone_call',
    benefits: ['Same-day emergency response', '24/7 availability', 'Immediate tarping', 'Full repair + insurance claim management'],
    proof_elements: ['8+ years emergency experience', 'Licensed and fully insured'],
    urgency_elements: ['Every hour of delay risks more damage'],
    faq: [{ question: 'How fast can you get here?', answer: 'Within 2 hours for emergency calls in our service area.' }],
    landing_page_type: 'call_only', status: 'approved',
    created_at: '2026-03-01T00:00:00Z', updated_at: '2026-03-01T00:00:00Z',
  },
  {
    id: 'offer-3', client_id: 'demo-client-1', name: 'Insurance Claim Assistance',
    offer_type: 'lead_generation', headline: 'We Handle Your Roof Insurance Claim — Start to Finish',
    subheadline: 'Most homeowners pay $0 out of pocket.',
    description: 'Our claims specialists work directly with your insurance company. We handle all paperwork, adjuster meetings, and supplemental claims.',
    primary_cta: 'Check Your Coverage Free', conversion_type: 'lead_form',
    benefits: ['Full claim management', 'We meet the adjuster on-site', 'Supplemental claims for missed damage', 'Most homeowners pay $0'],
    proof_elements: ['97% claim approval rate', 'Average claim value: $12,500'],
    urgency_elements: ['Filing deadlines vary by policy'],
    faq: [{ question: 'What if my claim is denied?', answer: 'We specialize in appeals. Most denials can be overturned with proper documentation.' }],
    landing_page_type: 'lead_capture', status: 'approved',
    created_at: '2026-03-01T00:00:00Z', updated_at: '2026-03-01T00:00:00Z',
  },
]

export const MOCK_INTAKE_QUESTIONS: IntakeQuestion[] = [
  { id: 'iq-1', client_id: 'demo-client-1', section: 'Your Best Customers', question: 'Think about your last 5 favorite customers. What did they have in common?', answer: 'They were homeowners with storm damage, were responsive, let us handle insurance, and referred neighbors.', sort_order: 1, created_at: '2026-03-01T00:00:00Z', updated_at: '2026-03-01T00:00:00Z' },
  { id: 'iq-2', client_id: 'demo-client-1', section: 'Your Best Customers', question: 'When someone calls, what\'s the #1 thing they say they need help with?', answer: 'They think they might have roof damage from a recent storm.', sort_order: 2, created_at: '2026-03-01T00:00:00Z', updated_at: '2026-03-01T00:00:00Z' },
  { id: 'iq-3', client_id: 'demo-client-1', section: 'What Makes People Buy', question: 'What\'s the most common reason a lead becomes a customer?', answer: 'When we show them drone photos of damage they can\'t see from the ground.', sort_order: 3, created_at: '2026-03-01T00:00:00Z', updated_at: '2026-03-01T00:00:00Z' },
  { id: 'iq-4', client_id: 'demo-client-1', section: 'Hesitations & Objections', question: 'What\'s the #1 reason someone almost hires you but doesn\'t?', answer: 'Worried about insurance rates going up, or they go with the cheapest quote.', sort_order: 4, created_at: '2026-03-01T00:00:00Z', updated_at: '2026-03-01T00:00:00Z' },
  { id: 'iq-5', client_id: 'demo-client-1', section: 'Timing & Urgency', question: 'Is there a time of year that causes a spike in inquiries?', answer: 'Spring hail season (March-May) and after any major storm for 2-3 weeks.', sort_order: 5, created_at: '2026-03-01T00:00:00Z', updated_at: '2026-03-01T00:00:00Z' },
  { id: 'iq-6', client_id: 'demo-client-1', section: 'Competition', question: 'When you lose a deal, who is it usually to?', answer: 'Storm chaser crews that offer lower prices but aren\'t local.', sort_order: 6, created_at: '2026-03-01T00:00:00Z', updated_at: '2026-03-01T00:00:00Z' },
]

export const MOCK_COMPETITOR_INTEL: CompetitorIntel[] = [
  { id: 'ci-1', client_id: 'demo-client-1', competitor_name: 'StormGuard Roofing', competitor_website: 'https://stormguardroofing.com', source: 'meta_ad_library', ad_type: 'social', content: 'Did your roof survive the storm? FREE inspection + we handle your insurance claim.', screenshot_url: null, keywords: null, notes: 'Heavy fear-based messaging. Similar free inspection offer.', captured_at: '2026-03-15T00:00:00Z', created_at: '2026-03-15T00:00:00Z' },
  { id: 'ci-2', client_id: 'demo-client-1', competitor_name: 'DFW Roof Pros', competitor_website: 'https://dfwroofpros.com', source: 'google_ads', ad_type: 'search', content: 'Roof Repair DFW - $500 Off Any Repair | Licensed & Insured | Free Estimates.', screenshot_url: null, keywords: ['roof repair dfw', 'roofing company dallas'], notes: 'Competing on price. Discount-heavy.', captured_at: '2026-03-18T00:00:00Z', created_at: '2026-03-18T00:00:00Z' },
  { id: 'ci-3', client_id: 'demo-client-1', competitor_name: 'Apex Restoration', competitor_website: 'https://apexrestoration.com', source: 'meta_ad_library', ad_type: 'social', content: 'Your home deserves the best. Apex Restoration: Award-winning roofing, siding, and windows.', screenshot_url: null, keywords: null, notes: 'Premium positioning. Beautiful creative assets.', captured_at: '2026-03-10T00:00:00Z', created_at: '2026-03-10T00:00:00Z' },
]
