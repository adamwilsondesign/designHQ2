import React, { useState } from 'react';
import { Box, Checkbox, IconButton, List, ListItem, ListItemIcon, ListItemText, Stack, TextField, Button, Typography } from '@mui/material';
import { Trash2 } from 'lucide-react';
import { ErrorState, LoadingState } from '../../../common/components/States';
import { todayIso } from '../../../common/firebaseHelpers';
import { addTask, removeTask, setTaskDone, useTasks } from '../hooks/useTasks';

// Today's tasks: anything due today or earlier that's still open, plus what
// was finished today.
export default function TodayTasks({ uid }: { uid: string | null }) {
  const tasks = useTasks(uid);
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const today = todayIso();
  const visible = tasks.data
    .filter(t => (t.dueDate <= today && !t.done) || (t.done && t.dueDate === today))
    .sort((a, b) => Number(a.done) - Number(b.done) || a.dueDate.localeCompare(b.dueDate));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uid || !title.trim()) return;
    try {
      await addTask(uid, title.trim(), today);
      setTitle('');
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  if (tasks.loading) return <LoadingState />;
  return (
    <Box>
      {(tasks.error || error) && <ErrorState message={tasks.error || error!} />}
      <Stack direction="row" spacing={1} component="form" onSubmit={submit} sx={{ mb: 1 }}>
        <TextField size="small" fullWidth placeholder="Add a task for today" value={title} onChange={e => setTitle(e.target.value)} inputProps={{ 'aria-label': 'New task' }} />
        <Button type="submit" variant="outlined" disabled={!title.trim()}>Add</Button>
      </Stack>
      {visible.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>Nothing due today. Add a task above.</Typography>
      ) : (
        <List dense disablePadding>
          {visible.map(t => (
            <ListItem key={t.id} disablePadding divider secondaryAction={
              <IconButton edge="end" size="small" aria-label={`Delete ${t.title}`} onClick={() => removeTask(t.id)}><Trash2 size={16} /></IconButton>
            }>
              <ListItemIcon sx={{ minWidth: 36 }}>
                <Checkbox size="small" edge="start" checked={t.done} onChange={e => setTaskDone(t.id, e.target.checked)} inputProps={{ 'aria-label': t.title }} />
              </ListItemIcon>
              <ListItemText primary={t.title} secondary={t.dueDate < today && !t.done ? `Carried over from ${t.dueDate}` : undefined}
                primaryTypographyProps={{ sx: { textDecoration: t.done ? 'line-through' : 'none', color: t.done ? 'text.secondary' : 'text.primary' } }} />
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
}
