import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';

// Plain, clean .docx from the same light markdown the AI writes:
// "# " title, "## " / "### " headings, "- " bullets, blank-line paragraphs,
// "**bold**" spans. Used for tailored resumes and cover letters.
function runs(text: string): TextRun[] {
  return text
    .split(/(\*\*[^*]+\*\*)/g)
    .filter(Boolean)
    .map(part => (/^\*\*[^*]+\*\*$/.test(part) ? new TextRun({ text: part.slice(2, -2), bold: true }) : new TextRun(part)));
}

export function markdownToParagraphs(md: string): Paragraph[] {
  const out: Paragraph[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) out.push(new Paragraph({ children: runs(para.join(' ')), spacing: { after: 120 } }));
    para = [];
  };
  for (const raw of md.replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trim();
    if (!line) { flush(); continue; }
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      flush();
      const level = h[1].length;
      out.push(new Paragraph({
        children: runs(h[2]),
        heading: level === 1 ? HeadingLevel.TITLE : level === 2 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2,
        alignment: level === 1 ? AlignmentType.LEFT : undefined,
        spacing: { before: level === 1 ? 0 : 200, after: 80 },
      }));
      continue;
    }
    if (/^[-*•]\s+/.test(line)) {
      flush();
      out.push(new Paragraph({ children: runs(line.replace(/^[-*•]\s+/, '')), bullet: { level: 0 }, spacing: { after: 60 } }));
      continue;
    }
    para.push(line);
  }
  flush();
  return out;
}

export async function markdownToDocx(md: string, title: string): Promise<Buffer> {
  const doc = new Document({
    title,
    styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
    sections: [{ properties: { page: { margin: { top: 1000, bottom: 1000, left: 1100, right: 1100 } } }, children: markdownToParagraphs(md) }],
  });
  return Buffer.from(await Packer.toBuffer(doc));
}
