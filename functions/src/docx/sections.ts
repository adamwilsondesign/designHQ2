import JSZip from 'jszip';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { classifyHeading, Classification } from './classify.js';

// Splits a .docx into sections at heading paragraphs and rebuilds it with new
// content in selected sections.
//
// Assumption (unverified until the real templates are uploaded): each proposal
// section starts with a paragraph using a Word heading style ("Heading 1",
// "Heading 2", ...) or an outline level. If a template marks sections some
// other way (e.g. bold Normal text, text boxes, or page-level tables),
// parseTemplate reports zero sections and the Templates screen says so.

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

export interface TemplateSection {
  index: number;
  heading: string;
  level: number;
  classification: Classification;
  text: string; // plain text of the section body, used as a style reference for the AI
  hasTable: boolean;
}

type El = any; // xmldom Element; its typings don't line up with lib.dom

function children(el: El, localName?: string): El[] {
  const out: El[] = [];
  for (let n = el.firstChild; n; n = n.nextSibling) {
    if (n.nodeType === 1 && (!localName || n.localName === localName)) out.push(n);
  }
  return out;
}

function first(el: El, localName: string): El | null {
  return children(el, localName)[0] || null;
}

function attr(el: El | null, name: string): string | null {
  if (!el) return null;
  return el.getAttributeNS(W, name) || el.getAttribute(`w:${name}`) || null;
}

function textOf(el: El): string {
  const parts: string[] = [];
  const walk = (n: El) => {
    for (let c = n.firstChild; c; c = c.nextSibling) {
      if (c.nodeType !== 1) continue;
      if (c.localName === 't') parts.push(c.textContent || '');
      else if (c.localName === 'tab') parts.push('\t');
      else if (c.localName === 'br') parts.push('\n');
      else walk(c);
    }
  };
  walk(el);
  return parts.join('');
}

// styleId -> heading level, from styles.xml (handles renamed/localised style ids).
function headingStyleLevels(stylesXml: string | null): Map<string, number> {
  const levels = new Map<string, number>();
  if (!stylesXml) return levels;
  const doc = new DOMParser().parseFromString(stylesXml, 'text/xml');
  const styles = doc.getElementsByTagNameNS(W, 'style');
  for (let i = 0; i < styles.length; i++) {
    const s = styles[i] as El;
    if (attr(s, 'type') !== 'paragraph') continue;
    const id = attr(s, 'styleId');
    if (!id) continue;
    const name = attr(first(s, 'name'), 'val') || '';
    const m = /^heading\s*(\d)$/i.exec(name.trim());
    if (m) {
      levels.set(id, Number(m[1]));
      continue;
    }
    const pPr = first(s, 'pPr');
    const outline = attr(first(pPr || s, 'outlineLvl'), 'val');
    if (pPr && outline !== null && /^\d$/.test(outline)) levels.set(id, Number(outline) + 1);
  }
  return levels;
}

function paragraphHeadingLevel(p: El, styleLevels: Map<string, number>): number | null {
  const pPr = first(p, 'pPr');
  if (!pPr) return null;
  const outline = attr(first(pPr, 'outlineLvl'), 'val');
  if (outline !== null && /^\d$/.test(outline)) return Number(outline) + 1;
  const styleId = attr(first(pPr, 'pStyle'), 'val');
  if (!styleId) return null;
  if (styleLevels.has(styleId)) return styleLevels.get(styleId)!;
  const m = /^heading\s*(\d)$/i.exec(styleId);
  return m ? Number(m[1]) : null;
}

interface Loaded {
  zip: JSZip;
  doc: El;
  body: El;
  styleLevels: Map<string, number>;
}

async function load(buffer: Buffer): Promise<Loaded> {
  const zip = await JSZip.loadAsync(buffer);
  const docXml = await zip.file('word/document.xml')?.async('string');
  if (!docXml) throw new Error('Not a .docx file (word/document.xml missing).');
  const stylesXml = (await zip.file('word/styles.xml')?.async('string')) || null;
  const doc = new DOMParser().parseFromString(docXml, 'text/xml');
  const body = doc.getElementsByTagNameNS(W, 'body')[0];
  if (!body) throw new Error('word/document.xml has no body.');
  return { zip, doc, body, styleLevels: headingStyleLevels(stylesXml) };
}

interface Boundary {
  heading: El;
  level: number;
  text: string;
  bodyEls: El[];
}

// Sections are delimited by headings at the shallowest level in use (ignoring
// headings with no text). Deeper headings stay inside their parent section.
function findSections({ body, styleLevels }: Loaded): Boundary[] {
  const els = children(body).filter(e => e.localName !== 'sectPr');
  const headingLevels = els.map(e =>
    e.localName === 'p' && textOf(e).trim() ? paragraphHeadingLevel(e, styleLevels) : null,
  );
  const present = headingLevels.filter((l): l is number => l !== null);
  if (present.length === 0) return [];
  const sectionLevel = Math.min(...present);

  const out: Boundary[] = [];
  let current: Boundary | null = null;
  els.forEach((e, i) => {
    if (headingLevels[i] === sectionLevel) {
      current = { heading: e, level: sectionLevel, text: textOf(e).trim(), bodyEls: [] };
      out.push(current);
    } else if (current) {
      current.bodyEls.push(e);
    }
  });
  return out;
}

export async function parseTemplate(buffer: Buffer): Promise<{ sections: TemplateSection[]; preamble: string }> {
  const loaded = await load(buffer);
  const found = findSections(loaded);
  const allEls = children(loaded.body).filter(e => e.localName !== 'sectPr');
  const firstHeadingIdx = found.length ? allEls.indexOf(found[0].heading) : allEls.length;
  const preamble = allEls.slice(0, firstHeadingIdx).map(textOf).join('\n').trim();

  return {
    preamble,
    sections: found.map((s, index) => ({
      index,
      heading: s.text,
      level: s.level,
      classification: classifyHeading(s.text),
      text: s.bodyEls.map(e => (e.localName === 'tbl' ? tableText(e) : textOf(e))).join('\n').trim(),
      hasTable: s.bodyEls.some(e => e.localName === 'tbl'),
    })),
  };
}

function tableText(tbl: El): string {
  return children(tbl, 'tr')
    .map(tr => children(tr, 'tc').map(tc => textOf(tc).trim()).join(' | '))
    .join('\n');
}

// ---------- rendering ----------

// Content format accepted per section (what the AI is asked to produce):
//   blank line separates paragraphs
//   "- " or "* " starts a bullet
//   "### " starts a sub-heading
//   "| a | b |" lines form a table
export async function renderWithSections(
  templateBuffer: Buffer,
  replacements: Record<number, string>,
): Promise<Buffer> {
  const loaded = await load(templateBuffer);
  const { doc, body, zip, styleLevels } = loaded;
  const sections = findSections(loaded);

  for (const [indexStr, content] of Object.entries(replacements)) {
    const s = sections[Number(indexStr)];
    if (!s) throw new Error(`Template has no section ${indexStr}.`);

    // Formatting samples taken from the section being replaced, falling back
    // to the rest of the document, so new text inherits the template's look.
    const pool = [...s.bodyEls, ...sections.flatMap(x => x.bodyEls)];
    const isPlain = (e: El) => e.localName === 'p' && textOf(e).trim() && paragraphHeadingLevel(e, styleLevels) === null;
    const isList = (e: El) => isPlain(e) && first(first(e, 'pPr') || e, 'numPr');
    const bodySample = pool.find(e => isPlain(e) && !isList(e)) || null;
    const bulletSample = pool.find(isList) || null;
    const subheadingSample =
      children(body).find(e => e.localName === 'p' && textOf(e).trim() && (paragraphHeadingLevel(e, styleLevels) ?? 0) > s.level) || null;
    const tableSample = pool.find(e => e.localName === 'tbl') || null;

    const anchor = s.bodyEls.length ? s.bodyEls[s.bodyEls.length - 1].nextSibling : s.heading.nextSibling;
    s.bodyEls.forEach(e => body.removeChild(e));

    for (const block of toBlocks(content)) {
      let el: El;
      if (block.type === 'table') el = makeTable(doc, block.rows, tableSample, bodySample);
      else if (block.type === 'bullet') el = makeParagraph(doc, block.text, bulletSample || bodySample);
      else if (block.type === 'subheading') el = makeParagraph(doc, block.text, subheadingSample || bodySample);
      else el = makeParagraph(doc, block.text, bodySample);
      body.insertBefore(el, anchor);
    }
  }

  zip.file('word/document.xml', new XMLSerializer().serializeToString(doc));
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

type Block =
  | { type: 'paragraph'; text: string }
  | { type: 'bullet'; text: string }
  | { type: 'subheading'; text: string }
  | { type: 'table'; rows: string[][] };

export function toBlocks(content: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  let table: string[][] = [];
  const flushPara = () => {
    if (para.length) blocks.push({ type: 'paragraph', text: para.join(' ') });
    para = [];
  };
  const flushTable = () => {
    if (table.length) blocks.push({ type: 'table', rows: table });
    table = [];
  };
  for (const raw of content.replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trim();
    if (/^\|.*\|$/.test(line)) {
      flushPara();
      if (/^\|[\s:|-]+\|$/.test(line)) continue; // markdown separator row
      table.push(line.slice(1, -1).split('|').map(c => c.trim()));
      continue;
    }
    flushTable();
    if (!line) flushPara();
    else if (/^[-*•]\s+/.test(line)) {
      flushPara();
      blocks.push({ type: 'bullet', text: line.replace(/^[-*•]\s+/, '') });
    } else if (/^#{1,6}\s+/.test(line)) {
      flushPara();
      blocks.push({ type: 'subheading', text: line.replace(/^#{1,6}\s+/, '') });
    } else para.push(line);
  }
  flushPara();
  flushTable();
  return blocks;
}

function makeParagraph(doc: El, text: string, sample: El | null): El {
  const p = doc.createElementNS(W, 'w:p');
  const samplePPr = sample ? first(sample, 'pPr') : null;
  if (samplePPr) p.appendChild(samplePPr.cloneNode(true));
  const sampleRun = sample ? children(sample, 'r').find(r => first(r, 't')) : null;
  const sampleRPr = sampleRun ? first(sampleRun, 'rPr') : null;

  // **bold** spans become bold runs; everything else uses the sample run style.
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  for (const part of parts) {
    const bold = /^\*\*[^*]+\*\*$/.test(part);
    const r = doc.createElementNS(W, 'w:r');
    if (sampleRPr || bold) {
      const rPr = sampleRPr ? sampleRPr.cloneNode(true) : doc.createElementNS(W, 'w:rPr');
      if (bold && !first(rPr, 'b')) rPr.insertBefore(doc.createElementNS(W, 'w:b'), rPr.firstChild);
      r.appendChild(rPr);
    }
    const t = doc.createElementNS(W, 'w:t');
    t.setAttribute('xml:space', 'preserve');
    t.appendChild(doc.createTextNode(bold ? part.slice(2, -2) : part));
    r.appendChild(t);
    p.appendChild(r);
  }
  return p;
}

function makeTable(doc: El, rows: string[][], sample: El | null, bodySample: El | null): El {
  const width = Math.max(...rows.map(r => r.length));
  const tbl = doc.createElementNS(W, 'w:tbl');
  const sampleTblPr = sample ? first(sample, 'tblPr') : null;
  if (sampleTblPr) tbl.appendChild(sampleTblPr.cloneNode(true));
  else {
    const tblPr = doc.createElementNS(W, 'w:tblPr');
    const style = doc.createElementNS(W, 'w:tblStyle');
    style.setAttributeNS(W, 'w:val', 'TableGrid');
    const w = doc.createElementNS(W, 'w:tblW');
    w.setAttributeNS(W, 'w:w', '5000');
    w.setAttributeNS(W, 'w:type', 'pct');
    tblPr.appendChild(style);
    tblPr.appendChild(w);
    tbl.appendChild(tblPr);
  }
  const grid = doc.createElementNS(W, 'w:tblGrid');
  for (let i = 0; i < width; i++) grid.appendChild(doc.createElementNS(W, 'w:gridCol'));
  tbl.appendChild(grid);
  rows.forEach((row, ri) => {
    const tr = doc.createElementNS(W, 'w:tr');
    for (let ci = 0; ci < width; ci++) {
      const tc = doc.createElementNS(W, 'w:tc');
      const text = row[ci] ?? '';
      tc.appendChild(makeParagraph(doc, ri === 0 && text ? `**${text.replace(/\*\*/g, '')}**` : text, bodySample));
      tr.appendChild(tc);
    }
    tbl.appendChild(tr);
  });
  return tbl;
}
