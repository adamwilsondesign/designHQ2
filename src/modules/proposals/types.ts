export type TemplateVariant = 'commerce-eng' | 'commerce-design' | 'core-eng' | 'core-design';

export const TEMPLATE_VARIANTS: { id: TemplateVariant; label: string }[] = [
  { id: 'commerce-eng', label: 'Commerce · with engineering' },
  { id: 'commerce-design', label: 'Commerce · design only' },
  { id: 'core-eng', label: 'Core · with engineering' },
  { id: 'core-design', label: 'Core · design only' },
];

export interface TemplateSection {
  index: number;
  heading: string;
  kind: 'static' | 'variable';
  key: string | null;
  needsReview: boolean;
  confirmed: boolean;
  reason: string;
  text: string;
  hasTable: boolean;
}

// proposalTemplates/{variant}
export interface ProposalTemplate {
  id: TemplateVariant;
  label: string;
  storagePath: string;
  fileName: string;
  uploadedAt: string;
  parseStatus: 'pending' | 'parsed' | 'error';
  parseError?: string | null;
  sections?: TemplateSection[];
  preamble?: string;
  // Custom document property names found in the template (e.g. CLIENT, "Phase 1 Start Date").
  properties?: string[];
  copiedFrom?: TemplateVariant;
}

export interface DraftSection {
  index: number;
  heading: string;
  content: string;
}

// proposals/{id}
export interface Proposal {
  id: string;
  clientName: string;
  templateId: TemplateVariant;
  notes: string;
  transcripts: { path: string; name: string }[];
  status: 'new' | 'draft';
  draft?: { version: number; sections: DraftSection[]; openQuestions: string[]; fields?: Record<string, string>; generatedAt?: unknown };
  reviewNotes?: string;
  sectionNotes?: Record<string, string>;
  history?: { version: number; sections: DraftSection[]; reviewNotes: string }[];
  docxPath?: string;
  docxVersion?: number;
  createdAt: string;
  updatedAt?: unknown;
  createdBy: string;
}
