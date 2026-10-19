import React from 'react';
import { Box, Card, CardContent, Skeleton, Typography } from '@mui/material';

// Summary metric. `size="hero"` is used for the revenue row on the dashboard.
export default function MetricCard({
  label,
  value,
  detail,
  size = 'default',
  loading = false,
  children,
}: {
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  size?: 'hero' | 'default';
  loading?: boolean;
  children?: React.ReactNode;
}) {
  const hero = size === 'hero';
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent sx={{ p: hero ? 3 : 2, '&:last-child': { pb: hero ? 3 : 2 } }}>
        <Typography variant="overline" color="text.secondary" component="div">{label}</Typography>
        {loading ? (
          <Skeleton width="60%" height={hero ? 48 : 32} />
        ) : (
          <Typography variant={hero ? 'h3' : 'h5'} component="div" sx={{ fontVariantNumeric: 'tabular-nums', mt: 0.5 }}>
            {value}
          </Typography>
        )}
        {detail && <Box sx={{ mt: 1, color: 'text.secondary', typography: 'body2' }}>{detail}</Box>}
        {children}
      </CardContent>
    </Card>
  );
}
