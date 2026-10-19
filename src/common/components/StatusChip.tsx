import React from 'react';
import { Chip } from '@mui/material';

// Semantic status colours only: success = on track, warning = attention, error = at risk.
export type Tone = 'success' | 'warning' | 'error' | 'default' | 'info';

export default function StatusChip({ label, tone = 'default' }: { label: string; tone?: Tone }) {
  return <Chip size="small" label={label} color={tone === 'default' ? 'default' : tone} variant="outlined" sx={{ fontWeight: 500 }} />;
}
