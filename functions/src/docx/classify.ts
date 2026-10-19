// Classifies proposal template sections by heading text.
//
// The section lists come from Adam's spec. Real template headings have not been
// inspected yet, so matching is deliberately conservative: anything that does
// not match, or matches both lists, is flagged for Adam to confirm in the
// Templates screen instead of being guessed. Unconfirmed sections are treated as
// static, so nothing is rewritten by the AI unless it was clearly variable.

export type SectionKind = 'static' | 'variable';

export interface Classification {
  kind: SectionKind;
  key: string | null; // canonical section key, e.g. 'executiveSummary'
  needsReview: boolean;
  reason: string;
}

export const VARIABLE_SECTIONS: { key: string; label: string; patterns: RegExp[] }[] = [
  { key: 'executiveSummary', label: 'Executive summary', patterns: [/executive summary/] },
  { key: 'objectives', label: 'Objectives', patterns: [/objectives?/] },
  { key: 'outOfScope', label: 'Out of scope', patterns: [/out[\s-]*of[\s-]*scope/] },
  { key: 'phaseScopeBudget', label: 'Phase scope and budget', patterns: [/phase/, /scope (and|&) budget/, /budget/] },
  { key: 'architecture', label: 'Architecture', patterns: [/architecture/] },
  { key: 'approach', label: 'Approach', patterns: [/approach/] },
];

export const STATIC_SECTIONS: { key: string; label: string; patterns: RegExp[] }[] = [
  { key: 'aboutLazer', label: 'About Lazer', patterns: [/about lazer/] },
  { key: 'team', label: 'Team', patterns: [/\bteam\b/] },
  { key: 'shopifyPartnership', label: 'Shopify partnership', patterns: [/shopify/] },
  { key: 'whyLazer', label: 'Why Lazer', patterns: [/why lazer/] },
  { key: 'methodology', label: 'Methodology', patterns: [/methodology/] },
  { key: 'raci', label: 'RACI', patterns: [/\braci\b/] },
  { key: 'performanceStandards', label: 'Performance standards', patterns: [/performance standards?/] },
  { key: 'postLaunchSupport', label: 'Post-launch support', patterns: [/post[\s-]*launch/] },
  { key: 'caseStudies', label: 'Case studies', patterns: [/case stud(y|ies)/] },
  { key: 'headlessAppendix', label: 'Headless appendix', patterns: [/headless/] },
  { key: 'mobileAppendix', label: 'Mobile appendix', patterns: [/\bmobile\b/] },
  { key: 'aiAppendix', label: 'AI appendix', patterns: [/\bai\b/, /artificial intelligence/] },
];

export function normalizeHeading(text: string) {
  return text
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/^[\s\d.)\-–—:]+/, '') // leading numbering like "1." or "2.3 -"
    .replace(/\s+/g, ' ')
    .trim();
}

export function classifyHeading(raw: string): Classification {
  const h = normalizeHeading(raw);
  const vMatches = VARIABLE_SECTIONS.filter(s => s.patterns.some(p => p.test(h)));
  const sMatches = STATIC_SECTIONS.filter(s => s.patterns.some(p => p.test(h)));

  // Anything explicitly labelled an appendix is boilerplate.
  if (/appendix/.test(h) && sMatches.length > 0) {
    return { kind: 'static', key: sMatches[0].key, needsReview: false, reason: `appendix matching "${sMatches[0].label}"` };
  }
  if (vMatches.length === 1 && sMatches.length === 0) {
    return { kind: 'variable', key: vMatches[0].key, needsReview: false, reason: `matches "${vMatches[0].label}"` };
  }
  if (sMatches.length === 1 && vMatches.length === 0) {
    return { kind: 'static', key: sMatches[0].key, needsReview: false, reason: `matches "${sMatches[0].label}"` };
  }
  if (vMatches.length + sMatches.length === 0) {
    return { kind: 'static', key: null, needsReview: true, reason: 'heading not in either list; kept as static until confirmed' };
  }
  const labels = [...vMatches, ...sMatches].map(s => s.label).join(', ');
  return { kind: 'static', key: null, needsReview: true, reason: `ambiguous (matches ${labels}); kept as static until confirmed` };
}
