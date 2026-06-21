import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  const buildHash = Math.random().toString(36).substring(2, 10);
  
  return {
    plugins: [
      react(), 
      tailwindcss(),
      {
        name: 'sw-versioning',
        closeBundle() {
          const swPath = path.resolve(__dirname, 'dist/sw.js');
          if (fs.existsSync(swPath)) {
            let sw = fs.readFileSync(swPath, 'utf8');
            sw = sw.replace(/CACHE_NAME\s*=\s*'[^']+'/, `CACHE_NAME = 'app-cache-${buildHash}'`);
            fs.writeFileSync(swPath, sw);
            console.log(`[sw-versioning] Injected cache version: app-cache-${buildHash}`);
          }
        }
      }
    ],
    define: {
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(`v2.0.0-${buildHash}`),
    },
    optimizeDeps: {
      exclude: ['@jsquash/png', '@jsquash/jpeg', '@jsquash/webp', '@jsquash/avif', '@jsquash/resize']
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        'react': path.resolve(__dirname, 'node_modules/react'),
        'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
        'react-router-dom$': path.resolve(__dirname, 'node_modules/react-router-dom'),
        'react-router$': path.resolve(__dirname, 'node_modules/react-router'),
      },
      dedupe: ['react', 'react-dom', 'react-router-dom', 'react-router'],
    },
    worker: {
      format: 'es',
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
