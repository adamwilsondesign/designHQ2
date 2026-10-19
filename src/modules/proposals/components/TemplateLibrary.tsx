import React, { useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Collapse, MenuItem, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip, Typography,
} from '@mui/material';
import { ChevronDown, ChevronRight } from 'lucide-react';
import FileDrop from '../../../common/components/FileDrop';
import StatusChip from '../../../common/components/StatusChip';
import { ErrorState, LoadingState } from '../../../common/components/States';
import { copyTemplateToEmptyVariants, reparseTemplate, saveTemplateSections, uploadTemplate, useTemplates } from '../hooks/useProposals';
import { ProposalTemplate, TEMPLATE_VARIANTS, TemplateSection, TemplateVariant } from '../types';

// The four proposal variants. Each upload is parsed into sections; Adam
// confirms which are static boilerplate and which the AI should write.
export default function TemplateLibrary() {
  const templates = useTemplates();
  if (templates.loading) return <LoadingState />;
  if (templates.error) return <ErrorState message={templates.error} />;
  return (
    <Stack spacing={2}>
      <Alert severity="info">
        Upload each variant as a .docx. Sections are split on Word heading styles and matched against the static list (About Lazer, Team, Shopify
        partnership, Why Lazer, Methodology, RACI, Performance standards, Post-launch support, Case studies, appendices) and the variable list
        (Executive summary, Objectives, Out of scope, Phase scope and budget, Architecture, Approach). Anything that doesn't match cleanly is
        flagged for you to confirm before it can be used.
      </Alert>
      {TEMPLATE_VARIANTS.map(v => (
        <TemplateCard key={v.id} variant={v.id} label={v.label} template={templates.data.find(t => t.id === v.id) || null} all={templates.data} />
      ))}
    </Stack>
  );
}

function TemplateCard({ variant, label, template, all }: { variant: TemplateVariant; label: string; template: ProposalTemplate | null; all: ProposalTemplate[] }) {
  const [progress, setProgress] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const sections = template?.sections || [];
  const toReview = sections.filter(s => !s.confirmed).length;

  const upload = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      await uploadTemplate(variant, file, setProgress);
      setOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const status = !template ? <StatusChip label="Not uploaded" /> :
    template.parseStatus === 'pending' ? <StatusChip label="Parsing…" /> :
    template.parseStatus === 'error' ? <StatusChip label="Parse failed" tone="error" /> :
    toReview > 0 ? <StatusChip label={`${toReview} to confirm`} tone="warning" /> :
    <StatusChip label="Ready" tone="success" />;

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
          <Box sx={{ flex: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{label}</Typography>
              {status}
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {template ? `${template.fileName} · uploaded ${new Date(template.uploadedAt).toLocaleDateString()}` : 'No file yet'}
              {sections.length > 0 && ` · ${sections.filter(s => s.kind === 'variable').length} variable / ${sections.filter(s => s.kind === 'static').length} static sections`}
            </Typography>
            {!!template?.properties?.length && (
              <Typography variant="caption" color="text.secondary" display="block">
                Document fields: {template.properties.join(', ')}
              </Typography>
            )}
          </Box>
          <Box sx={{ width: { md: 320 } }}>
            <FileDrop label={template ? 'Replace file' : 'Upload template'} accept={['.docx']} onFile={upload} progress={progress} disabled={busy} />
          </Box>
        </Stack>
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        {template?.parseStatus === 'error' && (
          <Alert severity="error" sx={{ mt: 2 }} action={<Button color="inherit" size="small" onClick={() => reparseTemplate(variant).catch(e => setError(e.message))}>Retry</Button>}>
            {template.parseError}
          </Alert>
        )}
        {template?.parseStatus === 'parsed' && all.length < TEMPLATE_VARIANTS.length && (
          <Button size="small" variant="outlined" sx={{ mt: 1.5, mr: 1 }}
            onClick={() => copyTemplateToEmptyVariants(template, all).catch(e => setError(e.message))}>
            Use for empty variants
          </Button>
        )}
        {sections.length > 0 && (
          <>
            <Button size="small" sx={{ mt: 1.5 }} startIcon={open ? <ChevronDown size={16} /> : <ChevronRight size={16} />} onClick={() => setOpen(!open)}>
              {open ? 'Hide sections' : 'Review sections'}
            </Button>
            <Collapse in={open}>
              <SectionTable variant={variant} sections={sections} />
            </Collapse>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function SectionTable({ variant, sections }: { variant: TemplateVariant; sections: TemplateSection[] }) {
  const [saving, setSaving] = useState(false);
  const update = async (next: TemplateSection[]) => {
    setSaving(true);
    try {
      await saveTemplateSections(variant, next);
    } finally {
      setSaving(false);
    }
  };
  const setKind = (i: number, kind: TemplateSection['kind']) =>
    update(sections.map(s => (s.index === i ? { ...s, kind, confirmed: true, needsReview: false, reason: 'set by Adam' } : s)));
  const unconfirmed = sections.filter(s => !s.confirmed);

  return (
    <Box sx={{ mt: 1 }}>
      {unconfirmed.length > 0 && (
        <Alert severity="warning" sx={{ mb: 1.5 }}
          action={<Button color="inherit" size="small" disabled={saving} onClick={() => update(sections.map(s => ({ ...s, confirmed: true, needsReview: false })))}>Confirm as shown</Button>}>
          {unconfirmed.length} section{unconfirmed.length === 1 ? '' : 's'} didn't match the lists. They're kept static until you confirm.
        </Alert>
      )}
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell width={48} align="right">#</TableCell>
              <TableCell>Heading</TableCell>
              <TableCell width={180}>Treatment</TableCell>
              <TableCell>Why</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sections.map(s => (
              <TableRow key={s.index} sx={{ bgcolor: s.confirmed ? undefined : 'action.hover' }}>
                <TableCell align="right">{s.index + 1}</TableCell>
                <TableCell>
                  <Tooltip title={s.text.slice(0, 400) || '(empty)'} placement="top-start"><span>{s.heading}</span></Tooltip>
                  {s.hasTable && <Typography component="span" variant="caption" color="text.secondary"> · has table</Typography>}
                </TableCell>
                <TableCell>
                  <TextField select size="small" fullWidth value={s.kind} disabled={saving} onChange={e => setKind(s.index, e.target.value as TemplateSection['kind'])}>
                    <MenuItem value="static">Static (keep as is)</MenuItem>
                    <MenuItem value="variable">Variable (AI writes)</MenuItem>
                  </TextField>
                </TableCell>
                <TableCell><Typography variant="caption" color="text.secondary">{s.confirmed ? s.reason : `Needs review: ${s.reason}`}</Typography></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
