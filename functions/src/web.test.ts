import { describe, expect, it } from 'vitest';
import { assertPublicUrl, htmlToText } from './web.js';
import { markdownToParagraphs } from './docx/simpleDoc.js';

describe('assertPublicUrl', () => {
  it('accepts public https URLs', () => {
    expect(assertPublicUrl('https://www.linkedin.com/jobs/view/123').hostname).toBe('www.linkedin.com');
  });
  it.each(['file:///etc/passwd', 'http://localhost:8080', 'http://169.254.169.254/latest', 'http://metadata.google.internal/', 'http://10.0.0.5/', 'not a url'])('rejects %s', u => {
    expect(() => assertPublicUrl(u)).toThrow();
  });
});

describe('htmlToText', () => {
  it('drops scripts and keeps readable text', () => {
    expect(htmlToText('<h1>Senior Designer</h1><script>x()</script><ul><li>Figma</li><li>Systems</li></ul><p>Remote &amp; NYC</p>'))
      .toBe('Senior Designer\n\n- Figma\n- Systems\n\nRemote & NYC');
  });
});

describe('markdownToParagraphs', () => {
  it('builds headings, bullets and paragraphs', () => {
    expect(markdownToParagraphs('# Adam Wilson\n## Experience\n- Led design\n\nSome text\nwrapped')).toHaveLength(4);
  });
});
