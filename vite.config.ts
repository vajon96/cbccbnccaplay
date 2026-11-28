import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  const rawBase = (process.env.VITE_BASE_PATH || '/').trim();
  const trimmedBase = rawBase.replace(/^\/+|\/+$/g, '');
  const basePath = trimmedBase ? `/${trimmedBase}/` : '/';
  const baseSegmentsCount = trimmedBase ? trimmedBase.split('/').filter(Boolean).length : 0;
  const escapedBase = basePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  return {
    base: basePath,
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icon.svg', 'apple-touch-icon.png', 'offline.html'],
        manifest: {
          name: "Cox's Bazar City College BNCC Platoon Portal",
          short_name: 'CBCC BNCC',
          description:
            "Official bilingual management, enrollment, examination, and cadet portal for Cox's Bazar City College BNCC Platoon (15 BNCC Battalion, Karnaphuli Regiment).",
          theme_color: '#002147',
          background_color: '#f8fafc',
          display: 'standalone',
          orientation: 'portrait-primary',
          scope: basePath,
          start_url: basePath,
          icons: [
            {
              src: `${basePath}pwa-192x192.png`,
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: `${basePath}pwa-512x512.png`,
              sizes: '512x512',
              type: 'image/png',
            },
            {
              src: `${basePath}pwa-maskable-512x512.png`,
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          globIgnores: ['**/assets/aistudio/**', '**/assets-manifest.json'],
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          navigateFallback: `${basePath}index.html`,
          navigateFallbackDenylist: [/^\/api\//, new RegExp(`^${escapedBase}api/`)],
          runtimeCaching: [
            {
              urlPattern: /\/api\/.*/i,
              handler: 'NetworkOnly',
            },
            {
              urlPattern: /^https:\/\/(identitytoolkit\.googleapis\.com|securetoken\.googleapis\.com|firestore\.googleapis\.com)\/.*/i,
              handler: 'NetworkOnly',
            },
            {
              urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'bncc-fonts-cache',
                expiration: {
                  maxEntries: 20,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
              },
            },
            {
              urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'bncc-image-cache',
                expiration: {
                  maxEntries: 120,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: false,
        },
      }),
      {
        name: 'inject-base-segments-404',
        closeBundle() {
          const out404 = path.resolve(__dirname, 'dist', '404.html');
          if (fs.existsSync(out404)) {
            const content = fs.readFileSync(out404, 'utf8');
            const updated = content.replace(/"__VITE_BASE_SEGMENTS__"/g, String(baseSegmentsCount));
            fs.writeFileSync(out404, updated, 'utf8');
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      chunkSizeWarningLimit: 900,
    },
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-router-dom',
        'lucide-react',
        'framer-motion',
        'firebase/app',
        'firebase/auth',
        'firebase/firestore',
        'firebase/storage',
        'recharts',
        'xlsx',
        'jszip',
        'html5-qrcode',
        'qrcode.react',
        'jspdf',
        'jspdf-autotable',
        'html2canvas',
        'html-to-image',
        'emoji-picker-react',
        '@google/genai',
        'clsx',
        'tailwind-merge',
      ],
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: false,
      ws: false as const,
    },
  };
});
