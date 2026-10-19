import React, { useState } from 'react';
import { Autocomplete, Chip, TextField } from '@mui/material';

// Free-text list editor (target roles, companies, industries).
export default function TagInput({ label, value, onChange, placeholder }: { label: string; value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [input, setInput] = useState('');
  return (
    <Autocomplete
      multiple
      freeSolo
      options={[]}
      value={value}
      inputValue={input}
      onInputChange={(_, v) => setInput(v)}
      onChange={(_, v) => onChange((v as string[]).map(s => s.trim()).filter(Boolean))}
      onBlur={() => { if (input.trim()) { onChange([...value, input.trim()]); setInput(''); } }}
      renderTags={(v, getTagProps) => v.map((option, index) => <Chip size="small" label={option} {...getTagProps({ index })} key={option} />)}
      renderInput={params => <TextField {...params} label={label} placeholder={value.length ? '' : placeholder} helperText="Press Enter after each" size="small" />}
    />
  );
}
