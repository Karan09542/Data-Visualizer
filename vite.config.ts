import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  const buildHash = Math.random().toString(36).substring(2, 10);
  
    // Set dynamically for use in app
    process.env.VITE_APP_VERSION = `v2.0.0-${buildHash}`;
    
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
        },
        {
          name: 'mock-isomorphic-fetch',
          resolveId(source) {
            if (source === 'isomorphic-fetch') {
              return source;
            }
            return null;
          },
          load(id) {
            if (id === 'isomorphic-fetch') {
              return 'export default function(){};';
            }
            return null;
          }
        },
        {
          name: 'strip-require',
          transform(code) {
            if (code.includes('require("isomorphic-fetch")') || code.includes("require('isomorphic-fetch')")) {
              return { code: code.replace(/require\(['"]isomorphic-fetch['"]\)/g, '{}'), map: null };
            }
          }
        }
      ],
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
        'isomorphic-fetch': path.resolve(__dirname, 'src/dummy.js'),
      },
      dedupe: ['react', 'react-dom', 'react-router-dom', 'react-router'],
    },
    worker: {
      format: 'es',
      plugins: () => [
        {
          name: 'strip-require',
          transform(code) {
            if (code.includes('require("isomorphic-fetch")') || code.includes("require('isomorphic-fetch')")) {
              return { code: code.replace(/require\(['"]isomorphic-fetch['"]\)/g, '{}'), map: null };
            }
          }
        }
      ]
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
