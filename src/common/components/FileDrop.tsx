import React, { useRef, useState } from 'react';
import { Box, LinearProgress, Stack, Typography } from '@mui/material';
import { Upload } from 'lucide-react';

// Click-or-drop file picker with inline validation.
export default function FileDrop({
  label,
  accept,
  hint,
  onFile,
  progress,
  fileName,
  disabled,
}: {
  label: string;
  accept: string[]; // extensions, e.g. ['.pdf', '.docx']
  hint?: string;
  onFile: (file: File) => void;
  progress?: number | null;
  fileName?: string | null;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);

  const take = (file?: File) => {
    if (!file) return;
    const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
    if (!accept.includes(ext)) {
      setError(`${file.name} isn't a supported file. Use ${accept.join(', ')}.`);
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setError('Files must be under 25 MB.');
      return;
    }
    setError(null);
    onFile(file);
  };

  return (
    <Box>
      <Typography variant="body2" component="label" sx={{ fontWeight: 500, display: 'block', mb: 0.5 }}>{label}</Typography>
      <Box
        role="button"
        tabIndex={0}
        aria-disabled={disabled}
        onClick={() => !disabled && input.current?.click()}
        onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && !disabled && input.current?.click()}
        onDragOver={e => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={e => { e.preventDefault(); setOver(false); if (!disabled) take(e.dataTransfer.files?.[0]); }}
        sx={{
          border: '1px dashed',
          borderColor: error ? 'error.main' : over ? 'primary.main' : 'divider',
          borderRadius: 1,
          p: 2,
          cursor: disabled ? 'default' : 'pointer',
          bgcolor: over ? 'action.hover' : 'transparent',
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Upload size={18} />
          <Box>
            <Typography variant="body2">{fileName || 'Choose a file or drop it here'}</Typography>
            <Typography variant="caption" color="text.secondary">{hint || accept.join(', ')}</Typography>
          </Box>
        </Stack>
        {progress != null && progress < 100 && <LinearProgress variant="determinate" value={progress} sx={{ mt: 1.5 }} />}
      </Box>
      {error && <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>{error}</Typography>}
      <input ref={input} type="file" hidden accept={accept.join(',')} onChange={e => { take(e.target.files?.[0]); e.target.value = ''; }} />
    </Box>
  );
}
