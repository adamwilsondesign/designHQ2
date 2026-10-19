import React, { useState, useEffect } from 'react';
import { User, Role } from '../../lib/mockData';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { collection, onSnapshot, doc, updateDoc, setDoc } from 'firebase/firestore';
import { 
  Box, 
  Typography, 
  Card, 
  CardContent, 
  Paper, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  Select, 
  MenuItem, 
  Button, 
  Avatar, 
  Stack,
  useTheme,
  Alert,
  AlertTitle,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField
} from '@mui/material';
import { ShieldAlert, Save, UserCog, CheckCircle2, Plus } from 'lucide-react';

export default function Admin({ user }: { user: User }) {
  const theme = useTheme();
  const [users, setUsers] = useState<(User & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', name: '', role: 'Regular User' as Role });
  const [addingUser, setAddingUser] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User & { id: string })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'users');
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const handleUpdateRole = async (userId: string, newRole: Role) => {
    setSaving(userId);
    try {
      await updateDoc(doc(db, 'users', userId), { role: newRole });
      setSuccess(userId);
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    } finally {
      setSaving(null);
    }
  };

  const handleAddUser = async () => {
    if (!newUser.email || !newUser.name) return;
    
    const existingUser = users.find(u => u.email.toLowerCase() === newUser.email.toLowerCase());
    if (existingUser) {
      alert('A user with this email already exists.');
      return;
    }

    setAddingUser(true);
    try {
      const userRef = doc(db, 'users', newUser.email.toLowerCase());
      await setDoc(userRef, {
        email: newUser.email.toLowerCase(),
        name: newUser.name,
        role: newUser.role,
        avatar: `https://i.pravatar.cc/150?u=${newUser.email.toLowerCase()}`
      });
      setIsAddUserOpen(false);
      setNewUser({ email: '', name: '', role: 'Regular User' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${newUser.email}`);
    } finally {
      setAddingUser(false);
    }
  };

  if (user.role !== 'Super Admin') {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 12, textAlign: 'center' }}>
        <Paper 
          variant="outlined" 
          sx={{ 
            p: { xs: 4, md: 8 }, 
            textAlign: 'center', 
            borderRadius: 4, 
            bgcolor: 'background.paper',
            border: '1px dashed', 
            borderColor: 'error.light',
            maxWidth: 500
          }}
        >
          <Avatar sx={{ width: 64, height: 64, bgcolor: 'error.light', color: 'error.main', mx: 'auto', mb: 3 }}>
            <ShieldAlert size={32} />
          </Avatar>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 1, fontFamily: '"Outfit", sans-serif', letterSpacing: '-0.02em', color: 'error.main' }}>Access Denied</Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: 400, mx: 'auto' }}>
            Only Super Admins can access system settings. Please contact your administrator if you need access.
          </Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 4 }}>
        <Avatar sx={{ bgcolor: 'primary.container', color: 'primary.main', width: 48, height: 48 }}>
          <UserCog size={24} />
        </Avatar>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.02em', fontFamily: '"Outfit", sans-serif' }}>
            System Settings
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage user roles and permissions
          </Typography>
        </Box>
      </Stack>
      
      <Card variant="outlined" sx={{ borderRadius: 4, overflow: 'hidden' }}>
        <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>User Management</Typography>
            <Typography variant="body2" color="text.secondary">
              Assign roles to team members to control their access levels.
            </Typography>
          </Box>
          <Button 
            variant="contained" 
            startIcon={<Plus size={18} />}
            onClick={() => setIsAddUserOpen(true)}
            sx={{ borderRadius: 2 }}
          >
            Add User
          </Button>
        </Box>
        
        {loading ? (
          <Box sx={{ p: 8, textAlign: 'center' }}>
            <CircularProgress size={32} />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>Loading users...</Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead sx={{ bgcolor: theme.palette.mode === 'light' ? 'grey.50' : 'grey.900' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>User</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Email</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Role</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id} hover>
                    <TableCell>
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Avatar src={u.avatar} alt={u.name} sx={{ width: 32, height: 32 }} />
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{u.name}</Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">{u.email}</Typography>
                    </TableCell>
                    <TableCell>
                      <Select 
                        size="small"
                        value={u.role}
                        onChange={(e) => handleUpdateRole(u.id, e.target.value as Role)}
                        disabled={saving === u.id}
                        sx={{ 
                          minWidth: 160,
                          borderRadius: 2,
                          '& .MuiSelect-select': { py: 0.75, fontSize: '0.875rem' }
                        }}
                      >
                        <MenuItem value="Super Admin">Super Admin</MenuItem>
                        <MenuItem value="Admin">Admin</MenuItem>
                        <MenuItem value="Regular User">Regular User</MenuItem>
                      </Select>
                    </TableCell>
                    <TableCell align="right">
                      {success === u.id ? (
                        <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end" sx={{ color: 'success.main' }}>
                          <CheckCircle2 size={16} />
                          <Typography variant="caption" sx={{ fontWeight: 700 }}>Saved</Typography>
                        </Stack>
                      ) : saving === u.id ? (
                        <CircularProgress size={20} />
                      ) : (
                        <Typography variant="caption" color="text.disabled">Auto-saved</Typography>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>

      <Box sx={{ mt: 4 }}>
        <Alert severity="info" sx={{ borderRadius: 3 }}>
          <AlertTitle sx={{ fontWeight: 700 }}>Role Permissions</AlertTitle>
          <Typography variant="body2">
            <strong>Super Admin:</strong> Full access to all features and system settings.<br />
            <strong>Admin:</strong> Access to all features except system settings.<br />
            <strong>Regular User:</strong> Limited access to dashboard and personal assignments.
          </Typography>
        </Alert>
      </Box>

      <Dialog 
        open={isAddUserOpen} 
        onClose={() => setIsAddUserOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 4, p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 800, letterSpacing: '-0.02em', fontFamily: '"Outfit", sans-serif' }}>
          Add New User
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              label="Name"
              variant="filled"
              value={newUser.name}
              onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
              InputProps={{ disableUnderline: true, sx: { borderRadius: 3 } }}
            />
            <TextField
              fullWidth
              label="Email Address"
              variant="filled"
              type="email"
              value={newUser.email}
              onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
              InputProps={{ disableUnderline: true, sx: { borderRadius: 3 } }}
            />
            <TextField
              select
              fullWidth
              label="Role"
              variant="filled"
              value={newUser.role}
              onChange={(e) => setNewUser({ ...newUser, role: e.target.value as Role })}
              InputProps={{ disableUnderline: true, sx: { borderRadius: 3 } }}
            >
              <MenuItem value="Super Admin">Super Admin</MenuItem>
              <MenuItem value="Admin">Admin</MenuItem>
              <MenuItem value="Regular User">Regular User</MenuItem>
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button 
            onClick={() => setIsAddUserOpen(false)} 
            color="inherit"
            sx={{ borderRadius: 10 }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleAddUser} 
            variant="contained"
            disabled={addingUser || !newUser.name || !newUser.email}
            sx={{ borderRadius: 10, px: 4 }}
          >
            {addingUser ? 'Adding...' : 'Add User'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
