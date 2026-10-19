import React from 'react';
import { Box, Divider, Drawer, IconButton, Stack, Typography } from '@mui/material';
import { X } from 'lucide-react';

// Right-hand panel for detail views and forms.
export default function SidePanel({
  open,
  onClose,
  title,
  subtitle,
  width = 520,
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: React.ReactNode;
  width?: number;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: { xs: '100%', sm: width } } }}>
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" sx={{ px: 3, py: 2 }}>
        <Box>
          <Typography variant="h6" component="h2">{title}</Typography>
          {subtitle && <Typography variant="body2" color="text.secondary">{subtitle}</Typography>}
        </Box>
        <IconButton onClick={onClose} aria-label="Close panel" edge="end"><X size={18} /></IconButton>
      </Stack>
      <Divider />
      <Box sx={{ flex: 1, overflowY: 'auto', px: 3, py: 2 }}>{children}</Box>
      {footer && (
        <>
          <Divider />
          <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ px: 3, py: 2 }}>{footer}</Stack>
        </>
      )}
    </Drawer>
  );
}
