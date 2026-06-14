import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(), 
      tailwindcss(),
      {
        name: 'sw-versioning',
        closeBundle() {
          const hash = Math.random().toString(36).substring(2, 10);
          const swPath = path.resolve(__dirname, 'dist/sw.js');
          if (fs.existsSync(swPath)) {
            let sw = fs.readFileSync(swPath, 'utf8');
            sw = sw.replace(/CACHE_NAME\s*=\s*'[^']+'/, `CACHE_NAME = 'app-cache-${hash}'`);
            fs.writeFileSync(swPath, sw);
            console.log(`[sw-versioning] Injected cache version: app-cache-${hash}`);
          }
        }
      }
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    optimizeDeps: {
      exclude: ['@jsquash/png', '@jsquash/jpeg', '@jsquash/webp', '@jsquash/avif', '@jsquash/resize']
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    worker: {
      format: 'es',
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
