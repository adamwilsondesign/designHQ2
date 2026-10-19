import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  build: {
    rollupOptions: {
      onwarn(warning, warn) {
        // MUI and framer-motion ship "use client" directives for React Server
        // Components; they mean nothing in a Vite SPA.
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE' && /use client/.test(warning.message)) return;
        warn(warning);
      },
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('firebase')) return 'firebase';
          if (id.includes('@mui') || id.includes('@emotion')) return 'mui';
          if (id.includes('recharts') || id.includes('d3-')) return 'charts';
          // City-to-timezone lookup data used by the staff wizard; large but static.
          if (id.includes('city-timezones')) return 'city-timezones';
          if (id.includes('lucide-react')) return 'icons';
          return 'vendor';
        },
      },
    },
    // The largest chunk is city-timezones' static lookup data (~1.4 MB, 250 kB gzipped).
    chunkSizeWarningLimit: 1500,
  },
});
