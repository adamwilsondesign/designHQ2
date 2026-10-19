import React, { useState } from 'react';
import { loginWithGoogle } from '../lib/auth';
import { User } from '../lib/mockData';
import { Box, Paper, Typography, Button, Divider, Alert, useTheme, Avatar } from '@mui/material';
import { Hexagon } from 'lucide-react';

export default function Login({ onLogin }: { onLogin: (user: User) => void }) {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const theme = useTheme();

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError('');
      const user = await loginWithGoogle();
      if (user) {
        onLogin(user);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to process Google login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box 
      sx={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        p: 2,
        bgcolor: 'background.default',
      }}
    >
      <Paper 
        variant="outlined"
        sx={{ 
          maxWidth: 440, 
          width: '100%', 
          p: { xs: 4, md: 6 }, 
          borderRadius: 4,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: 'none',
        }}
      >
        <Box sx={{ position: 'relative', zIndex: 1, width: '100%' }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 5 }}>
            <Avatar 
              sx={{ 
                bgcolor: 'primary.main', 
                color: 'primary.onPrimary',
                width: 56, 
                height: 56,
                mb: 2,
                borderRadius: 3,
              }}
            >
              <Hexagon size={28} />
            </Avatar>
            <Typography variant="h3" sx={{ fontWeight: 700, letterSpacing: '-0.03em', textAlign: 'center', mb: 1, fontFamily: '"Outfit", sans-serif' }}>
              Design HQ
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center' }}>
              Agency Operations Platform
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 4, borderRadius: 2 }}>
              {error}
            </Alert>
          )}

          <Box sx={{ mb: 4 }}>
            <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, bgcolor: 'background.default' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                Secure Login
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Sign in with your Google account ending in <strong>@lazertechnologies.com</strong>.
              </Typography>
            </Paper>
          </Box>

          <Button 
            variant="contained" 
            fullWidth 
            size="large"
            onClick={handleGoogleLogin}
            disabled={loading}
            sx={{ 
              py: 1.5, 
              borderRadius: 2,
              textTransform: 'none',
              fontSize: '1rem',
              fontWeight: 600,
              mb: 3
            }}
          >
            {loading ? 'Signing in...' : 'Sign in with Google'}
          </Button>

          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 2 }}>
            By signing in, you agree to our Terms of Service and Privacy Policy.
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
}
