import React, { useState } from 'react';
import { User } from '../lib/mockData';
import { logout } from '../lib/auth';
import { canAccess, ModuleId } from '../lib/roles';
import ProfileEditDialog from './ProfileEditDialog';
import { 
  LayoutDashboard, 
  Users, 
  FolderKanban, 
  DollarSign, 
  Settings, 
  LogOut, 
  TrendingUp, 
  Sun,
  Moon,
  Menu as MenuIcon,
  Hexagon,
  Bell,
  CalendarDays,
  FileText,
  MessagesSquare,
  Megaphone,
  PenLine,
  Calendar,
  Briefcase,
  UserRound
} from 'lucide-react';
import { 
  Box, 
  Drawer, 
  List, 
  ListItem, 
  ListItemButton, 
  ListItemIcon, 
  ListItemText, 
  Typography, 
  IconButton, 
  Avatar, 
  Divider,
  useMediaQuery,
  useTheme,
  BottomNavigation,
  BottomNavigationAction,
  Paper,
  AppBar,
  Toolbar,
  Tooltip,
  Stack,
  Button
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

export default function Layout({ 
  user, 
  userId,
  currentView, 
  onNavigate, 
  onLogout, 
  isDarkMode,
  onToggleDarkMode,
  children 
}: LayoutProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isProfileEditOpen, setIsProfileEditOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    onLogout();
  };

  const navItems: { id: ModuleId, label: string, icon: typeof LayoutDashboard }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'staff', label: 'Staff', icon: Users },
    { id: 'allocation', label: 'Allocation', icon: CalendarDays },
    { id: 'projects', label: 'Projects', icon: FolderKanban },
    { id: 'revenue', label: 'Revenue', icon: DollarSign },
    { id: 'proposals', label: 'Proposals', icon: FileText },
    { id: 'meetings', label: 'Meetings', icon: MessagesSquare },
    { id: 'execUpdate', label: 'Exec Update', icon: Megaphone },
    { id: 'social', label: 'Social', icon: PenLine },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'jobSearch', label: 'Job Search', icon: Briefcase },
    { id: 'profile', label: 'Profile', icon: UserRound },
    { id: 'admin', label: 'Admin', icon: Settings },
  ];

  const visibleNavItems = navItems.filter(item => canAccess(user.role, item.id));

  const drawerContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.paper' }}>
      <Box sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Avatar 
          sx={{ 
            bgcolor: 'primary.main', 
            color: 'primary.onPrimary',
            width: 32, 
            height: 32,
            boxShadow: 'none',
            borderRadius: 2
          }}
        >
          <Hexagon size={18} />
        </Avatar>
        <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '-0.03em', color: 'text.primary' }}>
          Design HQ
        </Typography>
      </Box>
      
      <List sx={{ flexGrow: 1, px: 2, py: 2 }}>
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <ListItem key={item.id} disablePadding sx={{ mb: 1 }}>
              <ListItemButton
                selected={isActive}
                onClick={() => {
                  onNavigate(item.id);
                  if (isMobile) setIsDrawerOpen(false);
                }}
                sx={{
                  borderRadius: 2,
                  py: 1.5,
                  px: 2,
                  '&.Mui-selected': {
                    bgcolor: 'primary.container',
                    color: 'primary.onContainer',
                    '&:hover': {
                      bgcolor: 'primary.container',
                    },
                    '& .MuiListItemIcon-root': {
                      color: 'primary.onContainer',
                    },
                    '& .MuiTypography-root': {
                      fontWeight: 700,
                    }
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                </ListItemIcon>
                <ListItemText 
                  primary={item.label} 
                  primaryTypographyProps={{ 
                    variant: 'body2', 
                    sx: { letterSpacing: '0.01em' }
                  }} 
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      <Box sx={{ p: 2, mt: 'auto' }}>
        <Paper 
          variant="outlined" 
          sx={{ 
            p: 2, 
            borderRadius: 6, 
            bgcolor: 'action.hover',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            border: 'none'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, position: 'relative' }}>
            <Box 
              onClick={() => setIsProfileEditOpen(true)}
              sx={{ position: 'relative', cursor: 'pointer', '&:hover .edit-overlay': { opacity: 1 } }}
            >
              <Avatar src={user.avatar} sx={{ width: 44, height: 44, border: '2px solid', borderColor: 'background.paper' }} />
              <Box 
                className="edit-overlay"
                sx={{ 
                  position: 'absolute', 
                  top: 0, left: 0, right: 0, bottom: 0, 
                  bgcolor: 'rgba(0,0,0,0.5)', 
                  borderRadius: '50%', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  opacity: 0,
                  transition: 'opacity 0.2s'
                }}
              >
                <Typography variant="caption" sx={{ color: 'white', fontWeight: 600, fontSize: '0.6rem' }}>EDIT</Typography>
              </Box>
            </Box>
            <Box sx={{ overflow: 'hidden' }}>
              <Typography variant="body2" fontWeight={700} noWrap sx={{ letterSpacing: '-0.01em' }}>{user.name}</Typography>
              <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>{user.role}</Typography>
            </Box>
          </Box>

          <Stack direction="row" spacing={1} alignItems="center">
            <Tooltip title={isDarkMode ? 'Light Mode' : 'Dark Mode'}>
              <IconButton 
                onClick={onToggleDarkMode} 
                sx={{ 
                  width: 36,
                  height: 36,
                  flexShrink: 0,
                  bgcolor: 'background.paper',
                  boxShadow: theme.shadows[1],
                  '&:hover': { bgcolor: 'background.paper', opacity: 0.9 }
                }}
              >
                {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
              </IconButton>
            </Tooltip>
            <Button
              fullWidth
              variant="text"
              size="small"
              onClick={handleLogout}
              startIcon={<LogOut size={16} />}
              sx={{ 
                color: 'error.main',
                justifyContent: 'flex-start',
                px: 2,
                '&:hover': { bgcolor: 'error.lighter' }
              }}
            >
              Sign Out
            </Button>
          </Stack>
        </Paper>
      </Box>

      {userId && (
        <ProfileEditDialog 
          open={isProfileEditOpen} 
          onClose={() => setIsProfileEditOpen(false)} 
          user={user} 
          userId={userId} 
        />
      )}
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Desktop Sidebar */}
      {!isMobile && (
        <Drawer
          variant="permanent"
          sx={{
            width: 300,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: 300,
              boxSizing: 'border-box',
            },
          }}
        >
          {drawerContent}
        </Drawer>
      )}

      {/* Mobile App Bar */}
      {isMobile && (
        <AppBar 
          position="fixed" 
          color="transparent" 
          elevation={0} 
        >
          <Toolbar sx={{ justifyContent: 'space-between' }}>
            <IconButton
              edge="start"
              color="inherit"
              onClick={() => setIsDrawerOpen(true)}
            >
              <MenuIcon size={24} />
            </IconButton>
            
            <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '-0.03em', color: 'primary.main' }}>
              Design HQ
            </Typography>

            <Stack direction="row" spacing={0.5}>
              <IconButton onClick={onToggleDarkMode} color="inherit">
                {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
              </IconButton>
            </Stack>
          </Toolbar>
        </AppBar>
      )}

      {/* Desktop App Bar (Actions) */}
      {!isMobile && (
        <AppBar 
          position="fixed" 
          color="transparent" 
          elevation={0} 
          sx={{ 
            width: `calc(100% - 300px)`, 
            ml: '300px',
            borderBottom: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
            backdropFilter: 'blur(16px)',
            opacity: 0.98
          }}
        >
          <Toolbar sx={{ justifyContent: 'flex-end' }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <IconButton sx={{ color: 'text.secondary' }}>
                <Bell size={20} />
              </IconButton>
              <Avatar src={user.avatar} sx={{ width: 36, height: 36, ml: 1, border: '2px solid', borderColor: 'background.paper' }} />
            </Stack>
          </Toolbar>
        </AppBar>
      )}

      {/* Mobile Drawer */}
      <Drawer
        anchor="left"
        open={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        sx={{
          '& .MuiDrawer-paper': {
            width: 300,
            boxSizing: 'border-box',
            borderRadius: 0
          },
        }}
      >
        {drawerContent}
      </Drawer>

      {/* Main Content */}
      <Box 
        component="main" 
        sx={{ 
          flexGrow: 1, 
          p: { xs: 2, md: 4, lg: 6 }, 
          mt: { xs: 7, md: 0 },
          mb: { xs: 8, md: 0 },
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          transition: theme.transitions.create(['padding', 'margin'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
        }}
      >
        <Box sx={{ width: '100%', maxWidth: 1400 }}>
          {children}
        </Box>
      </Box>

      {/* Mobile Bottom Navigation (MD3 Navigation Bar) */}
      {isMobile && (
        <Paper 
          sx={{ 
            position: 'fixed', 
            bottom: 0, 
            left: 0, 
            right: 0, 
            zIndex: 1000,
            borderTop: '1px solid',
            borderColor: 'divider',
            borderRadius: 0,
            boxShadow: 'none',
            bgcolor: 'background.paper'
          }} 
          elevation={0}
        >
          <BottomNavigation
            value={currentView}
            onChange={(_, newValue) => onNavigate(newValue)}
            sx={{ 
              height: 72,
              bgcolor: 'transparent',
              '& .MuiBottomNavigationAction-root': {
                color: 'text.secondary',
                '&.Mui-selected': {
                  color: 'primary.main',
                  '& .MuiBottomNavigationAction-label': {
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    mt: 0.5
                  },
                  '& .MuiSvgIcon-root, & svg': {
                    color: 'primary.main',
                  }
                }
              }
            }}
          >
            {visibleNavItems.slice(0, 4).map((item) => {
              const Icon = item.icon;
              return (
                <BottomNavigationAction
                  key={item.id}
                  label={item.label}
                  value={item.id}
                  icon={<Icon size={24} />}
                />
              );
            })}
          </BottomNavigation>
        </Paper>
      )}
    </Box>
  );
}
