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

// ---------- custom document properties ----------
// Templates can define fill-in fields as Word custom properties (File > Info >
// Properties > Custom) shown through DOCPROPERTY fields, e.g. CLIENT,
// "Phase 1 Start Date". They are read at parse time and written at render time.

const CP = 'http://schemas.openxmlformats.org/officeDocument/2006/custom-properties';

export interface DocProperty {
  name: string;
  value: string;
}

async function readCustomProperties(zip: JSZip): Promise<DocProperty[]> {
  const xml = await zip.file('docProps/custom.xml')?.async('string');
  if (!xml) return [];
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const props = doc.getElementsByTagNameNS(CP, 'property');
  const out: DocProperty[] = [];
  for (let i = 0; i < props.length; i++) {
    const p = props[i] as El;
    out.push({ name: p.getAttribute('name') || '', value: (p.textContent || '').trim() });
  }
  return out.filter(p => p.name);
}

async function writeCustomProperties(zip: JSZip, values: Record<string, string>) {
  const xml = await zip.file('docProps/custom.xml')?.async('string');
  if (!xml) return;
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const props = doc.getElementsByTagNameNS(CP, 'property');
  for (let i = 0; i < props.length; i++) {
    const p = props[i] as El;
    const name = p.getAttribute('name') || '';
    const valueEl = Array.from(p.childNodes as ArrayLike<El>).find(n => n.nodeType === 1);
    if (!(name in values) || !valueEl) continue;
    while (valueEl.firstChild) valueEl.removeChild(valueEl.firstChild);
    valueEl.appendChild(doc.createTextNode(values[name]));
  }
  zip.file('docProps/custom.xml', new XMLSerializer().serializeToString(doc));
}

const docPropertyName = (instr: string) => /DOCPROPERTY\s+"?([^"\\]+?)"?(\s|\\|$)/i.exec(instr.trim())?.[1]?.trim() ?? null;

// Sets the displayed result of every DOCPROPERTY field whose property has a
// new value (complex fields: begin / instrText / separate / result / end, and
// simple w:fldSimple fields).
function updateDocPropertyFields(doc: El, values: Record<string, string>) {
  const setRuns = (runs: El[], value: string) => {
    let done = false;
    for (const r of runs) {
      for (const t of Array.from(r.getElementsByTagNameNS(W, 't') as ArrayLike<El>)) {
        while (t.firstChild) t.removeChild(t.firstChild);
        if (!done) {
          t.appendChild(doc.createTextNode(value));
          t.setAttribute('xml:space', 'preserve');
          done = true;
        }
      }
    }
  };

  const runs = Array.from(doc.getElementsByTagNameNS(W, 'r') as ArrayLike<El>);
  let state: 'none' | 'instr' | 'result' = 'none';
  let instr = '';
  let result: El[] = [];
  for (const r of runs) {
    const fld = first(r, 'fldChar');
    const type = fld ? attr(fld, 'fldCharType') : null;
    if (type === 'begin') { state = 'instr'; instr = ''; result = []; continue; }
    if (type === 'separate') { state = 'result'; continue; }
    if (type === 'end') {
      const name = docPropertyName(instr);
      if (name && name in values) setRuns(result, values[name]);
      state = 'none';
      continue;
    }
    if (state === 'instr') instr += Array.from(r.getElementsByTagNameNS(W, 'instrText') as ArrayLike<El>).map(e => e.textContent).join('');
    else if (state === 'result') result.push(r);
  }

  for (const f of Array.from(doc.getElementsByTagNameNS(W, 'fldSimple') as ArrayLike<El>)) {
    const name = docPropertyName(attr(f, 'instr') || '');
    if (name && name in values) setRuns(children(f, 'r'), values[name]);
  }
}

export async function parseTemplate(buffer: Buffer): Promise<{ sections: TemplateSection[]; preamble: string; properties: DocProperty[] }> {
  const loaded = await load(buffer);
  const found = findSections(loaded);
  const allEls = children(loaded.body).filter(e => e.localName !== 'sectPr');
  const firstHeadingIdx = found.length ? allEls.indexOf(found[0].heading) : allEls.length;
  const preamble = allEls.slice(0, firstHeadingIdx).map(textOf).join('\n').trim();

  return {
    preamble,
    properties: await readCustomProperties(loaded.zip),
    sections: found.map((s, index) => ({
      index,
      heading: s.text,
      level: s.level,
      classification: classifyHeading(s.text),
      text: s.bodyEls.map(e => describe(e, loaded.styleLevels, s.level)).filter(Boolean).join('\n').trim(),
      hasTable: s.bodyEls.some(e => e.localName === 'tbl'),
    })),
  };
}

const isListParagraph = (p: El) => !!first(first(p, 'pPr') || p, 'numPr');

// Section body as the same light markdown the AI writes back, so the model
// sees (and mirrors) the template's structure: sub-headings, lists and tables.
function describe(e: El, styleLevels: Map<string, number>, sectionLevel: number): string {
  if (e.localName === 'tbl') return tableText(e);
  if (e.localName !== 'p') return '';
  const text = textOf(e).trim();
  if (!text) return '';
  const level = paragraphHeadingLevel(e, styleLevels);
  if (level !== null && level > sectionLevel) return `${'#'.repeat(Math.min(6, level + 1))} ${text}`;
  return isListParagraph(e) ? `- ${text}` : text;
}

function cellText(tc: El): string {
  return children(tc, 'p')
    .map(p => textOf(p).trim())
    .map((t, i) => (t && isListParagraph(children(tc, 'p')[i]) ? `- ${t}` : t))
    .filter(Boolean)
    .join('<br>');
}

function tableText(tbl: El): string {
  return children(tbl, 'tr')
    .map(tr => `| ${children(tr, 'tc').map(cellText).join(' | ')} |`)
    .join('\n');
}

// ---------- rendering ----------

// Content format accepted per section (what the AI is asked to produce):
//   blank line separates paragraphs
//   "- " or "* " starts a bullet
//   "### " starts a sub-heading
//   "| a | b |" lines form a table
export interface RenderOptions {
  // Whole-word, case-sensitive replacements applied to every text run in the
  // body, headers and footers, e.g. { CLIENT: 'Acme' }. Static sections stay
  // otherwise verbatim.
  placeholders?: Record<string, string>;
  // New values for custom document properties, by property name.
  properties?: Record<string, string>;
}

const hasPageBreak = (e: El) =>
  e.localName === 'p' && Array.from(e.getElementsByTagNameNS(W, 'br') as ArrayLike<El>).some(b => attr(b, 'type') === 'page');

export async function renderWithSections(
  templateBuffer: Buffer,
  replacements: Record<number, string>,
  options: RenderOptions = {},
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
    // Skip the template's writer instructions ([ ... ], usually highlighted) as style samples.
    const isInstruction = (e: El) => /^\s*\[/.test(textOf(e)) || e.getElementsByTagNameNS(W, 'highlight').length > 0;
    const bodySample = pool.find(e => isPlain(e) && !isList(e) && !isInstruction(e)) || pool.find(e => isPlain(e) && !isList(e)) || null;
    const bulletSample = pool.find(e => isList(e) && !isInstruction(e)) || pool.find(isList) || null;
    const subheadingSample =
      children(body).find(e => e.localName === 'p' && textOf(e).trim() && (paragraphHeadingLevel(e, styleLevels) ?? 0) > s.level) || null;
    const tables = pool.filter(e => e.localName === 'tbl');

    // Trailing empty paragraphs that carry a page break separate this section
    // from the next one; keep them and write the new content above them.
    const isEmpty = (e: El) => e.localName === 'p' && !textOf(e).trim() && e.getElementsByTagNameNS(W, 'drawing').length === 0;
    let tail = s.bodyEls.length;
    while (tail > 0 && isEmpty(s.bodyEls[tail - 1])) tail--;
    const firstBreak = s.bodyEls.findIndex((e, j) => j >= tail && hasPageBreak(e));
    const keepFrom = firstBreak === -1 ? s.bodyEls.length : firstBreak;
    const kept = s.bodyEls.slice(keepFrom);
    const anchor = kept.length ? kept[0] : s.bodyEls.length ? s.bodyEls[s.bodyEls.length - 1].nextSibling : s.heading.nextSibling;
    s.bodyEls.slice(0, keepFrom).forEach(e => body.removeChild(e));

    for (const block of toBlocks(content)) {
      let el: El;
      if (block.type === 'table') {
        // Borrow styling only from a template table with the same column count.
        const width = Math.max(...block.rows.map(r => r.length));
        const sample = tables.find(t => children(children(t, 'tr')[0] || t, 'tc').length === width) || null;
        el = makeTable(doc, block.rows, sample, bodySample);
      }
      else if (block.type === 'bullet') el = makeParagraph(doc, block.text, bulletSample || bodySample);
      else if (block.type === 'subheading') el = makeParagraph(doc, block.text, subheadingSample || bodySample);
      else el = makeParagraph(doc, block.text, bodySample);
      body.insertBefore(el, anchor);
    }
  }

  const placeholders = Object.entries(options.placeholders || {}).filter(([k, v]) => k && v);
  const properties = Object.fromEntries(Object.entries(options.properties || {}).filter(([k, v]) => k && v?.trim()));
  const hasProps = Object.keys(properties).length > 0;
  // Fields first, so their results aren't also run through text replacement.
  if (hasProps) updateDocPropertyFields(doc, properties);
  if (placeholders.length) replacePlaceholders(doc, placeholders);
  zip.file('word/document.xml', new XMLSerializer().serializeToString(doc));

  for (const name of Object.keys(zip.files).filter(n => /^word\/(header|footer)\d*\.xml$/.test(n))) {
    if (!placeholders.length && !hasProps) break;
    const part = new DOMParser().parseFromString(await zip.file(name)!.async('string'), 'text/xml');
    if (hasProps) updateDocPropertyFields(part, properties);
    if (placeholders.length) replacePlaceholders(part, placeholders);
    zip.file(name, new XMLSerializer().serializeToString(part));
  }
  // Keep the property store in sync; Word re-reads it when it refreshes fields.
  if (hasProps) await writeCustomProperties(zip, properties);

  // Ask Word to refresh fields (the table of contents) when the file opens,
  // since section content and sub-headings have changed.
  const settings = await zip.file('word/settings.xml')?.async('string');
  if (settings && !settings.includes('w:updateFields')) {
    zip.file('word/settings.xml', settings.replace(/<w:settings([^>]*)>/, '<w:settings$1><w:updateFields w:val="true"/>'));
  }
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function replacePlaceholders(doc: El, entries: [string, string][]) {
  const ts = doc.getElementsByTagNameNS(W, 't');
  for (let i = 0; i < ts.length; i++) {
    const t = ts[i] as El;
    let text = t.textContent || '';
    for (const [k, v] of entries) text = text.replace(new RegExp(`\\b${escapeRe(k)}\\b`, 'g'), v);
    if (text !== t.textContent) {
      while (t.firstChild) t.removeChild(t.firstChild);
      t.appendChild(doc.createTextNode(text));
      t.setAttribute('xml:space', 'preserve');
    }
  }
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
    for (const line of para) blocks.push({ type: 'paragraph', text: line });
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
      // Generated text never inherits the template's placeholder highlighting.
      for (const tag of ['highlight', 'shd']) {
        for (const n of Array.from(rPr.getElementsByTagNameNS(W, tag) as ArrayLike<El>)) rPr.removeChild(n);
      }
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

// Builds a table in the template's style. When the template has a table in
// the section with the same number of columns, its grid (column widths) and
// per-column cell properties (shading, borders, widths) are reused, header
// row from its first row and body rows from its second.
function makeTable(doc: El, rows: string[][], sample: El | null, bodySample: El | null): El {
  const width = Math.max(...rows.map(r => r.length));
  const tbl = doc.createElementNS(W, 'w:tbl');
  const sampleRows = sample ? children(sample, 'tr') : [];
  const sampleCells = (r: El | undefined) => (r ? children(r, 'tc') : []);
  const headerCells = sampleCells(sampleRows[0]);
  const bodyCells = sampleCells(sampleRows[1] || sampleRows[0]);
  const sameShape = headerCells.length === width;

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
  const sampleGrid = sample ? first(sample, 'tblGrid') : null;
  if (sameShape && sampleGrid) tbl.appendChild(sampleGrid.cloneNode(true));
  else {
    const grid = doc.createElementNS(W, 'w:tblGrid');
    for (let i = 0; i < width; i++) grid.appendChild(doc.createElementNS(W, 'w:gridCol'));
    tbl.appendChild(grid);
  }

  // Paragraph styles inside cells: plain and bulleted, from the sample table.
  const cellParas = (cells: El[]) => cells.flatMap(c => children(c, 'p')).filter(p => textOf(p).trim());
  const headerPara = cellParas(headerCells)[0] || bodySample;
  const bodyParas = cellParas(sampleRows.slice(1).flatMap(r => sampleCells(r)));
  const bodyPara = bodyParas.find(p => !isListParagraph(p)) || bodySample;
  const bulletPara = bodyParas.find(isListParagraph) || bodyPara;

  rows.forEach((row, ri) => {
    const tr = doc.createElementNS(W, 'w:tr');
    const header = ri === 0;
    for (let ci = 0; ci < width; ci++) {
      const tc = doc.createElementNS(W, 'w:tc');
      const sampleTc = sameShape ? (header ? headerCells : bodyCells)[ci] : null;
      const tcPr = sampleTc ? first(sampleTc, 'tcPr') : null;
      if (tcPr) tc.appendChild(tcPr.cloneNode(true));
      const parts = (row[ci] ?? '').split(/<br\s*\/?>/i).map(x => x.trim());
      for (const part of parts.length ? parts : ['']) {
        const bullet = /^[-*•]\s+/.test(part);
        const text = part.replace(/^[-*•]\s+/, '');
        const boldHeader = header && text && !sameShape ? `**${text.replace(/\*\*/g, '')}**` : text;
        tc.appendChild(makeParagraph(doc, boldHeader, header ? headerPara : bullet ? bulletPara : bodyPara));
      }
      tr.appendChild(tc);
    }
    tbl.appendChild(tr);
  });
  return tbl;
}
