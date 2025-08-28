import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    target: 'es2015',
    minify: 'terser',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          telegram: ['@twa-dev/sdk'],
          supabase: ['@supabase/supabase-js']
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    },
    chunkSizeWarningLimit: 500, // 500KB warning
    assetsInlineLimit: 4096 // 4KB
  },
  server: {
    port: 5175,
    host: true,
    allowedHosts: [
      'localhost',
      '.ngrok-free.app',
      '.ngrok.io',
      '.ngrok.app'
    ],
    proxy: {
      // Proxy Supabase API requests to avoid mixed content issues
      '/api/supabase': {
        target: 'http://127.0.0.1:54321',
        changeOrigin: true,
        secure: false,
        ws: true,
        rewrite: (path) => path.replace(/^\/api\/supabase/, ''),
        configure: (proxy, _options) => {
          proxy.on('error', (err, req, _res) => {
            console.log('❌ Proxy error:', err.message)
            console.log('❌ Failed request:', req.method, req.url)
          })
          
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            // Ensure all headers are properly forwarded
            console.log('🔄 Proxying request:', req.method, req.url)
            console.log('🔄 Headers being forwarded:', Object.keys(req.headers))
            
            // Ensure Content-Type is preserved for POST/PUT requests
            if (req.headers['content-type']) {
              proxyReq.setHeader('Content-Type', req.headers['content-type'])
            }
            
            // Ensure Authorization header is forwarded
            if (req.headers['authorization']) {
              proxyReq.setHeader('Authorization', req.headers['authorization'])
            }
            
            // Ensure apikey header is forwarded
            if (req.headers['apikey']) {
              proxyReq.setHeader('apikey', req.headers['apikey'])
            }
            
            // Add Accept header if missing
            if (!req.headers['accept']) {
              proxyReq.setHeader('Accept', 'application/json')
            }
          })
          
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('✅ Proxy response:', proxyRes.statusCode, req.method, req.url)
            if (proxyRes.statusCode && proxyRes.statusCode >= 400) {
              console.log('⚠️  Response headers:', proxyRes.headers)
            }
          })
        }
      }
    }
  },
  preview: {
    port: 5175,
    host: true,
    allowedHosts: [
      'localhost', 
      '.ngrok-free.app',
      '.ngrok.io',
      '.ngrok.app'
    ]
  }
})
