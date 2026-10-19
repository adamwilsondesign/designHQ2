import React from 'react';
import {
  Alert,
  Box,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { Project, StaffMember, User } from '../../../lib/mockData';
import { parseLocalDate } from '../../../lib/metrics';

// Regular-user home: the projects they are assigned to. The data is already
// scoped by App.tsx (and firestore.rules) to this user's staff record.
export default function MyAssignments({ user, staffList, projectsList }: { user: User; staffList: StaffMember[]; projectsList: Project[] }) {
  const me = staffList.find(s => s.id === user.staffId);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const rows = [...projectsList]
    .filter(p => !p.finishDate || parseLocalDate(p.finishDate) >= today)
    .sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Typography variant="h4" sx={{ fontWeight: 600, mb: 0.5 }}>
        Welcome back, {user.name.split(' ')[0]}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Your current and upcoming assignments.
      </Typography>

      {!user.staffId ? (
        <Alert severity="info">
          Your account isn't linked to a staff record yet, so there are no assignments to show. Ask an admin to link you in Admin → User Management.
        </Alert>
      ) : rows.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>No active assignments</Typography>
          <Typography variant="body2" color="text.secondary">When you're allocated to a project it will appear here.</Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Client</TableCell>
                <TableCell>Line of business</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Start</TableCell>
                <TableCell>Finish</TableCell>
                <TableCell align="right">Allocation</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map(p => {
                const started = p.startDate ? parseLocalDate(p.startDate) <= today : false;
                return (
                  <TableRow key={p.id} hover>
                    <TableCell sx={{ fontWeight: 600 }}>
                      {p.client} {started && <Chip size="small" label="Active" color="success" variant="outlined" sx={{ ml: 1 }} />}
                    </TableCell>
                    <TableCell>{p.lob}</TableCell>
                    <TableCell>{p.type}</TableCell>
                    <TableCell>{p.startDate ? parseLocalDate(p.startDate).toLocaleDateString() : '—'}</TableCell>
                    <TableCell>{p.finishDate ? parseLocalDate(p.finishDate).toLocaleDateString() : '—'}</TableCell>
                    <TableCell align="right">{me ? `${p.staffAllocations?.[me.id] ?? 100}%` : '—'}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
