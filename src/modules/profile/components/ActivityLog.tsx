import React, { useMemo } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { Bell, Briefcase, FileText, PenLine } from 'lucide-react';
import { EmptyState, ErrorState, LoadingState } from '../../../common/components/States';
import { usePersonalActivity } from '../hooks/usePersonalActivity';
import { ActivityKind, buildActivity } from '../lib/activity';

const ICON: Record<ActivityKind, typeof Bell> = { social: PenLine, job: Briefcase, tailored: FileText, reminder: Bell };

export default function ActivityLog({ uid }: { uid: string }) {
  const a = usePersonalActivity(uid);
  const items = useMemo(() => buildActivity(a), [a.drafts, a.applications, a.tailored, a.reminders]); // eslint-disable-line react-hooks/exhaustive-deps
  if (a.loading) return <LoadingState />;
  if (a.error) return <ErrorState message={a.error} />;
  if (items.length === 0) return <EmptyState title="No activity yet" description="Social drafts, job applications and handled reminders show up here." />;
  return (
    <Box component="ol" sx={{ listStyle: 'none', p: 0, m: 0 }}>
      {items.map((i, n) => {
        const Icon = ICON[i.kind];
        return (
          <Stack component="li" key={n} direction="row" spacing={1.5} sx={{ py: 1, borderBottom: 1, borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
            <Box sx={{ color: 'text.secondary', pt: 0.25 }}><Icon size={16} aria-hidden /></Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>{i.label}</Typography>
              <Typography variant="caption" color="text.secondary" noWrap display="block">{i.detail}</Typography>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>{new Date(i.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Typography>
          </Stack>
        );
      })}
    </Box>
  );
}
