import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
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
