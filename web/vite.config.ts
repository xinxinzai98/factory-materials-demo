import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'robots.txt'],
      manifest: {
        name: '工厂药品管理',
        short_name: '药管',
        theme_color: '#16a34a',
        background_color: '#0b1220',
        display: 'standalone',
        lang: 'zh-CN',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512x512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: {
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/warehouses') || url.pathname.startsWith('/api/locations') || url.pathname.startsWith('/api/materials') || url.pathname.startsWith('/api/settings/thresholds'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'api-ref-cache',
              expiration: { maxEntries: 200, maxAgeSeconds: 24 * 60 * 60 },
            },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/inbounds') || url.pathname.startsWith('/api/outbounds') || url.pathname.startsWith('/api/stocks') || url.pathname.startsWith('/api/metrics'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'api-list-cache',
              expiration: { maxEntries: 200, maxAgeSeconds: 10 * 60 },
            },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/notifications'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-notif-cache',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 100, maxAgeSeconds: 10 * 60 },
            },
          },
        ],
      },
    }),
  ],
  esbuild: { drop: ['console','debugger'] },
  resolve: {
    alias: {
  '@': path.resolve(process.cwd(), 'src'),
    },
  },
  server: {
  port: 5173,
  host: true,
  open: false,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 4173,
    host: true,
    open: false,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 1200,
  target: 'es2018',
  minify: 'esbuild',
  cssCodeSplit: true,
  modulePreload: { polyfill: false },
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')) return 'vendor-react'
            if (id.includes('antd')) return 'vendor-antd'
      if (id.includes('@ant-design/icons')) return 'vendor-icons'
            if (id.includes('rc-') || id.includes('@rc-component')) return 'vendor-rc'
            if (id.includes('dayjs')) return 'vendor-dayjs'
            return 'vendor'
          }
        }
      }
    }
  }
})
