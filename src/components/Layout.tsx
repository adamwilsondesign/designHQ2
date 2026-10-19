import React, { useEffect, useState } from 'react';
import { User } from '../lib/mockData';
import { logout } from '../lib/auth';
import { canAccess, ModuleId } from '../lib/roles';
import ProfileEditDialog from './ProfileEditDialog';
import {
  Briefcase,
  Calendar,
  CalendarDays,
  ChevronsLeft,
  ChevronsRight,
  DollarSign,
  FileText,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu as MenuIcon,
  MessagesSquare,
  Moon,
  PenLine,
  Settings,
  Sun,
  UserRound,
  Users,
  UserCog,
} from 'lucide-react';
import {
  Avatar,
  Box,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Menu,
  MenuItem,
  Stack,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';

interface LayoutProps {
  user: User;
  userId: string | null;
  currentView: string;
  onNavigate: (view: string) => void;
  onLogout: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  children: React.ReactNode;
}

const EXPANDED = 240;
const COLLAPSED = 64;
const COLLAPSE_KEY = 'dhq_sidebar_collapsed';

type NavItem = { id: ModuleId; label: string; icon: typeof LayoutDashboard };

const PROFESSIONAL: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'staff', label: 'Staff', icon: Users },
  { id: 'allocation', label: 'Allocation', icon: CalendarDays },
  { id: 'projects', label: 'Projects', icon: FolderKanban },
  { id: 'revenue', label: 'Revenue', icon: DollarSign },
  { id: 'proposals', label: 'Proposals', icon: FileText },
  { id: 'meetings', label: 'Meetings', icon: MessagesSquare },
  { id: 'execUpdate', label: 'Exec Update', icon: Megaphone },
];

const PERSONAL: NavItem[] = [
  { id: 'social', label: 'Social', icon: PenLine },
  { id: 'calendar', label: 'Calendar', icon: Calendar },
  { id: 'jobSearch', label: 'Job Search', icon: Briefcase },
  { id: 'profile', label: 'Profile', icon: UserRound },
];

const SYSTEM: NavItem[] = [{ id: 'admin', label: 'Admin', icon: Settings }];

// The Overview (original dashboard with charts and the allocation schedule)
// lives one level below Dashboard, so it highlights Dashboard in the nav.
const NAV_PARENT: Record<string, string> = { overview: 'dashboard' };

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
}

export default function Layout({ user, userId, currentView, onNavigate, onLogout, isDarkMode, onToggleDarkMode, children }: LayoutProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [isProfileEditOpen, setIsProfileEditOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
    } catch {
      // Private mode etc.: the sidebar just won't remember its state.
    }
  }, [collapsed]);

  const narrow = collapsed && !isMobile;
  const width = narrow ? COLLAPSED : EXPANDED;
  const active = NAV_PARENT[currentView] || currentView;

  const groups = [
    { label: 'Professional', items: PROFESSIONAL.filter(i => canAccess(user.role, i.id)) },
    { label: 'Personal', items: PERSONAL.filter(i => canAccess(user.role, i.id)) },
    { label: 'System', items: SYSTEM.filter(i => canAccess(user.role, i.id)) },
  ].filter(g => g.items.length > 0);

  const handleLogout = async () => {
    setMenuAnchor(null);
    await logout();
    onLogout();
  };

  const go = (id: string) => {
    onNavigate(id);
    if (isMobile) setMobileOpen(false);
  };

  const initials = user.name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();

  const sidebar = (
    <Box component="nav" aria-label="Main" sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.paper' }}>
      <Stack direction="row" alignItems="center" justifyContent={narrow ? 'center' : 'space-between'} sx={{ height: 56, px: narrow ? 0 : 2 }}>
        {!narrow && <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Design HQ</Typography>}
        {!isMobile && (
          <Tooltip title={narrow ? 'Expand sidebar' : 'Collapse sidebar'} placement="right">
            <IconButton size="small" onClick={() => setCollapsed(!collapsed)} aria-label={narrow ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!narrow}>
              {narrow ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
            </IconButton>
          </Tooltip>
        )}
      </Stack>
      <Divider />

      <Box sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', py: 1 }}>
        {groups.map((g, gi) => (
          <List
            key={g.label}
            dense
            disablePadding
            sx={{ px: 1, mt: gi === 0 ? 0 : 1 }}
            subheader={
              groups.length > 1 && !narrow ? (
                <ListSubheader disableSticky sx={{ bgcolor: 'transparent', lineHeight: '32px', px: 1.5, typography: 'overline', color: 'text.secondary' }}>
                  {g.label}
                </ListSubheader>
              ) : narrow && gi > 0 ? <Divider sx={{ my: 1, mx: 1 }} /> : undefined
            }
          >
            {g.items.map(item => {
              const Icon = item.icon;
              const selected = active === item.id;
              const button = (
                <ListItemButton
                  selected={selected}
                  onClick={() => go(item.id)}
                  aria-current={selected ? 'page' : undefined}
                  sx={{ minHeight: 36, my: 0.25, px: narrow ? 0 : 1.5, justifyContent: narrow ? 'center' : 'flex-start' }}
                >
                  <ListItemIcon sx={{ minWidth: narrow ? 0 : 32, color: selected ? 'text.primary' : 'text.secondary', justifyContent: 'center' }}>
                    <Icon size={18} strokeWidth={selected ? 2.25 : 1.75} aria-hidden />
                  </ListItemIcon>
                  {!narrow && <ListItemText primary={item.label} primaryTypographyProps={{ variant: 'body2', fontWeight: selected ? 600 : 400 }} />}
                </ListItemButton>
              );
              return narrow ? (
                <Tooltip key={item.id} title={item.label} placement="right">
                  <Box>{React.cloneElement(button, { 'aria-label': item.label } as Record<string, string>)}</Box>
                </Tooltip>
              ) : (
                <React.Fragment key={item.id}>{button}</React.Fragment>
              );
            })}
          </List>
        ))}
      </Box>

      <Divider />
      <ListItemButton
        onClick={e => setMenuAnchor(e.currentTarget)}
        aria-label="Account menu"
        aria-haspopup="menu"
        sx={{ flexGrow: 0, m: 1, px: narrow ? 0 : 1, justifyContent: narrow ? 'center' : 'flex-start', gap: 1.5 }}
      >
        <Avatar src={user.avatar || undefined} sx={{ width: 32, height: 32, bgcolor: 'action.selected', color: 'text.primary' }}>{initials}</Avatar>
        {!narrow && (
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>{user.name}</Typography>
            <Typography variant="caption" color="text.secondary" noWrap display="block">{user.role}</Typography>
          </Box>
        )}
      </ListItemButton>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      {isMobile ? (
        <>
          <Box
            component="header"
            sx={{ position: 'fixed', top: 0, left: 0, right: 0, height: 56, zIndex: theme.zIndex.appBar, display: 'flex', alignItems: 'center', gap: 1, px: 1, bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}
          >
            <IconButton onClick={() => setMobileOpen(true)} aria-label="Open navigation"><MenuIcon size={20} /></IconButton>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Design HQ</Typography>
          </Box>
          <Drawer open={mobileOpen} onClose={() => setMobileOpen(false)} PaperProps={{ sx: { width: EXPANDED } }} ModalProps={{ keepMounted: true }}>
            {sidebar}
          </Drawer>
        </>
      ) : (
        <Drawer
          variant="permanent"
          PaperProps={{ sx: { width, overflowX: 'hidden', transition: theme.transitions.create('width', { duration: theme.transitions.duration.shorter }) } }}
          sx={{ width, flexShrink: 0, transition: theme.transitions.create('width', { duration: theme.transitions.duration.shorter }) }}
        >
          {sidebar}
        </Drawer>
      )}

      <Box component="main" sx={{ flexGrow: 1, minWidth: 0, pt: isMobile ? 7 : 0 }}>
        <Box sx={{ maxWidth: 1440, mx: 'auto' }}>{children}</Box>
      </Box>

      <Menu
        anchorEl={menuAnchor}
        open={!!menuAnchor}
        onClose={() => setMenuAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>{user.name}</Typography>
          <Typography variant="caption" color="text.secondary">{user.email}</Typography>
        </Box>
        <Divider />
        <MenuItem onClick={() => { setMenuAnchor(null); setIsProfileEditOpen(true); }}>
          <ListItemIcon><UserCog size={16} /></ListItemIcon>Edit name and photo
        </MenuItem>
        <MenuItem onClick={() => { onToggleDarkMode(); }}>
          <ListItemIcon>{isDarkMode ? <Sun size={16} /> : <Moon size={16} />}</ListItemIcon>{isDarkMode ? 'Light mode' : 'Dark mode'}
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleLogout}>
          <ListItemIcon><LogOut size={16} /></ListItemIcon>Sign out
        </MenuItem>
      </Menu>

      {userId && <ProfileEditDialog open={isProfileEditOpen} onClose={() => setIsProfileEditOpen(false)} user={user} userId={userId} />}
    </Box>
  );
}
