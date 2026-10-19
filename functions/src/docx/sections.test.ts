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
      { type: 'paragraph', text: 'a' },
      { type: 'paragraph', text: 'b' },
      { type: 'bullet', text: 'x' },
      { type: 'subheading', text: 'H' },
      { type: 'table', rows: [['1', '2']] },
    ]);
  });
});

describe('real-template behaviours', () => {
  // Mirrors what the Lazer template does: page-break paragraphs styled as
  // Heading 1 between sections, CLIENT as both plain text and DOCPROPERTY
  // fields, highlighted [ instructions ], and Stage | Scope tables.
  async function lazerLike() {
    const { PageBreak } = await import('docx');
    const doc = new Document({
      customProperties: [{ name: 'CLIENT', value: 'CLIENT' }, { name: 'Phase 1 Start Date', value: 'Phase 1 Start Date' }],
      sections: [{
        children: [
          new Paragraph({ text: 'PREPARED FOR' }),
          new Paragraph({ text: 'FIELD_CLIENT' }),
          new Paragraph({ text: 'Executive Summary', heading: HeadingLevel.HEADING_1 }),
          new Paragraph({ children: [new TextRun({ text: '[WRITE SUMMARY]', highlight: 'yellow' })] }),
          new Paragraph({ children: [new TextRun('We help CLIENT grow.')] }),
          new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new PageBreak()] }),
          new Paragraph({ text: 'About Lazer', heading: HeadingLevel.HEADING_1 }),
          new Paragraph({ children: [new TextRun("CLIENT's team works with Lazer.")] }),
          new Paragraph({ text: 'Project Timeline and Budget', heading: HeadingLevel.HEADING_1 }),
          new Paragraph({ children: [new TextRun('Start: FIELD_DATE')] }),
          new Table({ rows: [
            new TableRow({ children: [new TableCell({ children: [new Paragraph('Stage')] }), new TableCell({ children: [new Paragraph('Scope')] })] }),
            new TableRow({ children: [new TableCell({ children: [new Paragraph('Discovery')] }), new TableCell({ children: [new Paragraph('Interviews')] })] }),
          ] }),
        ],
      }],
    });
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(Buffer.from(await Packer.toBuffer(doc)));
    let xml = await zip.file('word/document.xml')!.async('string');
    // A complex DOCPROPERTY field and a simple one, as Word writes them.
    xml = xml.replace(/<w:r>(?:(?!<w:r>).)*?FIELD_CLIENT<\/w:t><\/w:r>/,
      '<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> DOCPROPERTY "CLIENT" \\* MERGEFORMAT </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>CLIENT</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>');
    xml = xml.replace(/<w:r>(?:(?!<w:r>).)*?FIELD_DATE<\/w:t><\/w:r>/,
      '<w:fldSimple w:instr=" DOCPROPERTY &quot;Phase 1 Start Date&quot; "><w:r><w:t>Phase 1 Start Date</w:t></w:r></w:fldSimple>');
    zip.file('word/document.xml', xml);
    return { buffer: await zip.generateAsync({ type: 'nodebuffer' }), JSZip };
  }

  it('reads custom properties and describes structure for the AI', async () => {
    const { buffer } = await lazerLike();
    const { properties, sections } = await parseTemplate(buffer);
    expect(properties.map(p => p.name)).toEqual(['CLIENT', 'Phase 1 Start Date']);
    expect(sections.map(s => s.heading)).toEqual(['Executive Summary', 'About Lazer', 'Project Timeline and Budget']);
    expect(sections[2].text).toContain('| Stage | Scope |');
  });

  it('keeps page breaks, fills fields and CLIENT, and ignores instruction styling', async () => {
    const { buffer, JSZip } = await lazerLike();
    const out = await renderWithSections(buffer, {
      0: 'Acme wants to grow.\nSecond line.',
      2: '| Stage | Scope |\n|---|---|\n| Build | Theme:<br>- Homepage<br>- PDP |',
    }, { placeholders: { CLIENT: 'Acme' }, properties: { CLIENT: 'Acme', 'Phase 1 Start Date': 'Jan 12, 2027' } });

    const zip = await JSZip.loadAsync(out);
    const xml = await zip.file('word/document.xml')!.async('string');
    const text = (xml.match(/<w:t[^>]*>[^<]*<\/w:t>/g) || []).map(t => t.replace(/<[^>]+>/g, '')).join('|');
    expect(xml).toContain('w:type="page"');
    expect(text).not.toMatch(/\bCLIENT\b/);
    expect(text).toContain("Acme's team works with Lazer.");
    expect(text).toContain('PREPARED FOR|Acme');
    expect(await zip.file('docProps/custom.xml')!.async('string')).toContain('Jan 12, 2027');
    expect(await zip.file('word/settings.xml')!.async('string')).toContain('w:updateFields');

    const { sections } = await parseTemplate(out);
    expect(sections[0].text).toBe('Acme wants to grow.\nSecond line.');
    // The sample table has no list style, so cell bullets render as plain lines.
    expect(sections[2].text).toContain('| Build | Theme:<br>Homepage<br>PDP |');
    // The generated summary must not copy the highlighted instruction's run style.
    const summaryXml = xml.slice(xml.indexOf('Acme wants to grow.') - 400, xml.indexOf('Acme wants to grow.'));
    expect(summaryXml).not.toContain('w:highlight');
  });
});
