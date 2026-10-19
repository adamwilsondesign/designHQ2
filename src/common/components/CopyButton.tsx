import React, { useState } from 'react';
import { Button } from '@mui/material';
import { Check, Copy } from 'lucide-react';

export default function CopyButton({ text, label = 'Copy', variant = 'outlined' }: { text: string; label?: string; variant?: 'outlined' | 'contained' | 'text' }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant={variant}
      size="small"
      startIcon={copied ? <Check size={16} /> : <Copy size={16} />}
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? 'Copied' : label}
    </Button>
  );
}
