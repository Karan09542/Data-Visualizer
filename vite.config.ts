import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * What sw.ts does for input() / prompt() in production, for the dev server, where no service
 * worker is registered: /api/stdin-get is held open until /api/stdin-submit brings the answer.
 * Runs ahead of the /api proxy, so these never reach the remote server.
 */
function stdinBridge(): Plugin {
  const waiting = new Map<string, (body: object) => void>();
  const early = new Map<string, object>();
  const reply = (res: any, body: object) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(body));
  };

  return {
    name: 'stdin-bridge',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url || '/', 'http://localhost');

        if (url.pathname === '/api/stdin-get') {
          const sessionId = url.searchParams.get('sessionId') || '';
          if (early.has(sessionId)) {
            reply(res, early.get(sessionId)!);
            early.delete(sessionId);
            return;
          }
          const timer = setTimeout(() => {
            if (waiting.get(sessionId) === answer) waiting.delete(sessionId);
            reply(res, { value: null, timeout: true });
          }, 10 * 60 * 1000);
          const answer = (body: object) => {
            clearTimeout(timer);
            reply(res, body);
          };
          waiting.set(sessionId, answer);
          req.on('close', () => {
            if (waiting.get(sessionId) === answer) waiting.delete(sessionId);
            clearTimeout(timer);
          });
          return;
        }

        if (url.pathname === '/api/stdin-submit' && req.method === 'POST') {
          let raw = '';
          req.on('data', (chunk) => (raw += chunk));
          req.on('end', () => {
            try {
              const { type, sessionId, value } = JSON.parse(raw);
              const body = type === 'STDIN_CANCEL' ? { value: null, cancelled: true } : { value };
              const answer = waiting.get(sessionId);
              if (answer) {
                waiting.delete(sessionId);
                answer(body);
              } else {
                early.set(sessionId, body); // the code has not asked yet
              }
              reply(res, { ok: true });
            } catch {
              res.statusCode = 400;
              reply(res, { ok: false });
            }
          });
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const buildHash = Math.random().toString(36).substring(2, 10);

  // Set dynamically for use in app
  process.env.VITE_APP_VERSION = `v2.0.0-${buildHash}`;

  return {
    plugins: [
      react(),
      tailwindcss(),
      stdinBridge(),
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
          globPatterns: ['**/*.{js,mjs,css,html,ico,png,svg,woff,woff2,ttf,json,wasm}'],
          // The formula reader's runtime (21 MB) is downloaded on request and kept in OPFS.
          globIgnores: ['**/ort-wasm-*.wasm']
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
      exclude: ['@jsquash/png', '@jsquash/jpeg', '@jsquash/webp', '@jsquash/avif', '@jsquash/resize'],
      // Only the formula reader's worker imports it; bundling it up front avoids a
      // dev-server reload (and a cut-off model download) the first time it loads.
      include: ['@huggingface/transformers']
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
