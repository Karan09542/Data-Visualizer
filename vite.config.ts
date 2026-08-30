import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const buildHash = Math.random().toString(36).substring(2, 10);

  // Set dynamically for use in app
  process.env.VITE_APP_VERSION = `v2.0.0-${buildHash}`;

  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        registerType: 'prompt',
        injectRegister: null,
        devOptions: {
          enabled: true
        },
        manifest: {
          name: 'Data Visualizer',
          short_name: 'Visualizer',
          theme_color: '#ffffff',
          background_color: '#ffffff',
          display: 'standalone',
          start_url: '/',
          icons: [
            {
              src: '/app-icon.png',
              sizes: '192x192',
              type: 'image/png'
            }
          ],
          share_target: {
            action: '/share-receiver/',
            method: 'POST',
            enctype: 'multipart/form-data',
            params: {
              title: 'name',
              text: 'description',
              url: 'link',
              files: [
                {
                  name: 'files',
                  accept: [
                    'image/*',
                    'video/*',
                    'audio/*',
                    'application/pdf',
                    'application/json',
                    'application/x-yaml',
                    'text/yaml',
                    'text/plain',
                    'text/csv',
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    '.csv',
                    '.json',
                    '.yaml',
                    '.yml',
                    '.glb',
                    '.gltf',
                    '.obj',
                    '.txt',
                    '.pdf',
                    '.xlsx',
                    '.png',
                    '.jpg',
                    '.jpeg',
                    '.webp',
                    '.gif',
                    '.mp4',
                    '.webm',
                    '.mp3',
                    '.wav'
                  ]
                }
              ]
            }
          }
        },
        injectManifest: {
          maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,ttf,json,wasm}']
        }
      }),
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
      proxy: {
        '/api/nvidia': {
          target: 'https://integrate.api.nvidia.com/v1',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api\/nvidia/, ''),
        },
        '/api': {
          target: 'https://datavisualizer-signalling-server.onrender.com',
          changeOrigin: true,
          secure: false,
          headers: {
            Origin: 'https://datavisualizer.urlmediainspector.dev',
            Referer: 'https://datavisualizer.urlmediainspector.dev/',
          },
        },
        '/socket.io': {
          target: 'https://datavisualizer-signalling-server.onrender.com',
          ws: true,
          changeOrigin: true,
          secure: false,
          headers: {
            Origin: 'https://datavisualizer.urlmediainspector.dev',
            Referer: 'https://datavisualizer.urlmediainspector.dev/',
          },
        },
      },
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true' ? { overlay: false } : false,
    },
  };
});

// Trigger Vite restart
