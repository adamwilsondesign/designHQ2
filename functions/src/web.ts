import net from 'net';
import { HttpsError } from 'firebase-functions/v2/https';

// Fetches a public web page (job posting) as readable text. Only http(s) to
// public hostnames; private addresses and metadata endpoints are refused.
export function assertPublicUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new HttpsError('invalid-argument', 'That is not a valid URL.');
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw new HttpsError('invalid-argument', 'Only http and https links are supported.');
  const host = url.hostname.toLowerCase();
  const privateIp = (ip: string) =>
    /^(10\.|127\.|169\.254\.|192\.168\.|0\.)/.test(ip) || /^172\.(1[6-9]|2\d|3[01])\./.test(ip) || ip === '::1' || /^f[cd]/i.test(ip) || /^fe80/i.test(ip);
  if (host === 'localhost' || host.endsWith('.internal') || host.endsWith('.local') || (net.isIP(host) && privateIp(host))) {
    throw new HttpsError('invalid-argument', 'That address is not allowed.');
  }
  return url;
}

export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<(br|p|\/p|\/div|\/ul|\/ol|\/h\d|\/tr)(\s[^>]*)?\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim();
}

export async function fetchPageText(raw: string): Promise<{ text: string; title: string }> {
  const url = assertPublicUrl(raw);
  const res = await fetch(url, {
    redirect: 'follow',
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DesignHQ/1.0)', Accept: 'text/html,application/xhtml+xml' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new HttpsError('failed-precondition', `The page returned HTTP ${res.status}. Paste the posting text instead.`);
  const html = await res.text();
  const title = htmlToText(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] || '');
  return { text: htmlToText(html).slice(0, 40000), title };
}
