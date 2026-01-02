import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/features': path.resolve(__dirname, './src/features'),
      '@/shared': path.resolve(__dirname, './src/shared'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/core': path.resolve(__dirname, './src/core'),
      '@/types': path.resolve(__dirname, './src/types'),
      '@/constants': path.resolve(__dirname, './src/constants'),
      '@/stores': path.resolve(__dirname, './src/stores'),
      '@/layouts': path.resolve(__dirname, './src/layouts'),
      '@/routes': path.resolve(__dirname, './src/routes'),
      // rewrite lucide-react/src/* -> node_modules/lucide-react/dist/esm/*
      'lucide-react/src': path.resolve(__dirname, 'node_modules/lucide-react/dist/esm')
    }
  },
  // Dev server configuration (single `server` block). Keep port + proxy together.

  // Proxy API requests to backend during development so cookies (HttpOnly)
  // set by the backend are stored by the browser without cross-site issues.
  // With this proxy, frontend can use a relative '/api' base URL.
  server: {
    port: 5174,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'charts': ['recharts'],
          'ui': ['@radix-ui/react-dialog', '@radix-ui/react-select'],
          'vendor': ['react', 'react-dom', 'react-router-dom'],
        }
      }
    },
    chunkSizeWarningLimit: 1000,
  },
  ssr: {
    // ensure lucide-react is bundled in SSR builds so Vite doesn't treat it as external
    noExternal: ['lucide-react']
  },
  optimizeDeps: {
    include: ['lucide-react']
  }
});
