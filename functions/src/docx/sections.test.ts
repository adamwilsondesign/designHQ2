import { describe, expect, it } from 'vitest';
import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun } from 'docx';
import { parseTemplate, renderWithSections, toBlocks } from './sections.js';
import { classifyHeading } from './classify.js';

// Synthetic template shaped like the spec describes. The real templates have
// not been inspected; these tests pin the behaviour, not their exact layout.
async function makeTemplate() {
  const h = (text: string) => new Paragraph({ text, heading: HeadingLevel.HEADING_1 });
  const p = (text: string) => new Paragraph({ children: [new TextRun({ text, font: 'Inter', size: 22 })], alignment: AlignmentType.LEFT });
  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({ text: 'Proposal for {{Client}}', heading: HeadingLevel.TITLE }),
        h('1. Executive Summary'), p('Old summary text.'), p('Second para.'),
        h('About Lazer'), p('We are Lazer. This never changes.'),
        h('Objectives'), p('Old objectives.'),
        new Paragraph({ text: 'Sub point', heading: HeadingLevel.HEADING_2 }), p('Nested under objectives.'),
        h('Phase Scope and Budget'),
        new Table({ rows: [new TableRow({ children: [new TableCell({ children: [p('Phase')] }), new TableCell({ children: [p('Cost')] })] })] }),
        h('Headless Architecture Appendix'), p('Static appendix.'),
        h('Something Unexpected'), p('??'),
      ],
    }],
  });
  return Buffer.from(await Packer.toBuffer(doc));
}

describe('classifyHeading', () => {
  it.each([
    ['Executive Summary', 'variable', 'executiveSummary'],
    ['2. Out-of-Scope', 'variable', 'outOfScope'],
    ['Phase Scope & Budget', 'variable', 'phaseScopeBudget'],
    ['Why Lazer?', 'static', 'whyLazer'],
    ['RACI', 'static', 'raci'],
    ['Post-Launch Support', 'static', 'postLaunchSupport'],
    ['Appendix: Headless Architecture', 'static', 'headlessAppendix'],
    ['AI Appendix', 'static', 'aiAppendix'],
  ])('%s -> %s', (heading, kind, key) => {
    const c = classifyHeading(heading);
    expect(c.kind).toBe(kind);
    expect(c.key).toBe(key);
    expect(c.needsReview).toBe(false);
  });

  it('flags unknown and ambiguous headings for review and keeps them static', () => {
    expect(classifyHeading('Pricing Notes')).toMatchObject({ kind: 'static', needsReview: true });
    expect(classifyHeading('Team budget')).toMatchObject({ kind: 'static', needsReview: true });
    expect(classifyHeading('Something Unexpected')).toMatchObject({ kind: 'static', needsReview: true });
  });
});

describe('parseTemplate', () => {
  it('splits at top-level headings and classifies each section', async () => {
    const { sections, preamble } = await parseTemplate(await makeTemplate());
    expect(preamble).toBe('Proposal for {{Client}}');
    expect(sections.map(s => s.heading)).toEqual([
      '1. Executive Summary', 'About Lazer', 'Objectives', 'Phase Scope and Budget', 'Headless Architecture Appendix', 'Something Unexpected',
    ]);
    expect(sections.map(s => s.classification.kind)).toEqual(['variable', 'static', 'variable', 'variable', 'static', 'static']);
    expect(sections[2].text).toContain('Nested under objectives.');
    expect(sections[3].hasTable).toBe(true);
    expect(sections[5].classification.needsReview).toBe(true);
  });
});

describe('renderWithSections', () => {
  it('replaces only the chosen sections and leaves static text intact', async () => {
    const template = await makeTemplate();
    const out = await renderWithSections(template, {
      0: 'New summary with **bold** client goals.\n\nSecond paragraph.',
      3: '| Phase | Hours | Budget |\n|---|---|---|\n| Discovery | 80 | $16,000 |\n\n- Includes QA',
    });
    const { sections } = await parseTemplate(out);
    expect(sections).toHaveLength(6);
    expect(sections[0].text).toBe('New summary with bold client goals.\nSecond paragraph.');
    expect(sections[1].text).toBe('We are Lazer. This never changes.');
    expect(sections[2].text).toContain('Old objectives.');
    expect(sections[3].text).toContain('Discovery | 80 | $16,000');
    expect(sections[3].text).toContain('Includes QA');
    expect(sections[4].text).toBe('Static appendix.');
  });
});

describe('toBlocks', () => {
  it('parses paragraphs, bullets, subheadings and tables', () => {
    expect(toBlocks('a\nb\n\n- x\n### H\n| 1 | 2 |')).toEqual([
      { type: 'paragraph', text: 'a b' },
      { type: 'bullet', text: 'x' },
      { type: 'subheading', text: 'H' },
      { type: 'table', rows: [['1', '2']] },
    ]);
  });
});
