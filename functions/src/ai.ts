import { GoogleGenAI, Type } from '@google/genai';
import { defineSecret, defineString } from 'firebase-functions/params';
import { HttpsError } from 'firebase-functions/v2/https';

// All generation goes through here. The project already depended on
// @google/genai (it started life as an AI Studio app), so Gemini is the
// provider. Swap this file to change providers.
export const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');
// Model id is a deploy-time parameter so it can be changed without a code edit.
export const GEMINI_MODEL = defineString('GEMINI_MODEL', { default: 'gemini-2.5-pro' });

export { Type };

export async function generateJson<T>(opts: {
  system: string;
  prompt: string;
  schema: Record<string, unknown>;
  images?: { mimeType: string; data: string }[];
  useSearch?: boolean;
}): Promise<T> {
  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY.value() });
  const parts: any[] = [{ text: opts.prompt }];
  for (const img of opts.images || []) parts.push({ inlineData: img });
  try {
    const res = await ai.models.generateContent({
      model: GEMINI_MODEL.value(),
      contents: [{ role: 'user', parts }],
      config: {
        systemInstruction: opts.system,
        responseMimeType: 'application/json',
        responseSchema: opts.schema,
        temperature: 0.7,
      },
    });
    const text = res.text;
    if (!text) throw new Error('Empty response from model.');
    return JSON.parse(text) as T;
  } catch (err) {
    console.error('generateJson failed', err);
    throw new HttpsError('internal', `AI generation failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// Free-text grounded research (used for platform trends). Search grounding
// cannot be combined with a JSON response schema, so this returns text.
export async function generateGroundedText(system: string, prompt: string): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY.value() });
  try {
    const res = await ai.models.generateContent({
      model: GEMINI_MODEL.value(),
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { systemInstruction: system, tools: [{ googleSearch: {} }] },
    });
    return res.text || '';
  } catch (err) {
    console.error('generateGroundedText failed', err);
    return '';
  }
}
