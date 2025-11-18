import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Note: Compression and visualizer plugins removed due to missing dependencies
    // To re-enable, install: npm install -D rollup-plugin-visualizer vite-plugin-compression
  ],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  build: {
    // Generate sourcemaps for production debugging
    sourcemap: 'hidden', // hidden = generated but not referenced in files

    // Target modern browsers for better tree shaking
    target: 'es2020',

    // Minification
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.log in production
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info'], // Remove specific console methods
      },
      format: {
        comments: false, // Remove comments
      },
    },

    // Chunk size warnings
    chunkSizeWarningLimit: 1000, // Warn if chunk > 1MB

    // Rollup options for manual chunk splitting
    rollupOptions: {
      output: {
        // Manual chunk splitting strategy
        manualChunks: (id) => {
          // Vendor - React Core
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'vendor-react'
          }

          // Vendor - Radix UI Components
          if (id.includes('node_modules/@radix-ui')) {
            return 'vendor-ui'
          }

          // Vendor - Microsoft MSAL & Graph
          if (
            id.includes('node_modules/@azure/msal') ||
            id.includes('node_modules/@microsoft/microsoft-graph-client')
          ) {
            return 'vendor-ms'
          }

          // Vendor - Anthropic AI SDK
          if (id.includes('node_modules/@anthropic-ai')) {
            return 'vendor-ai'
          }

          // Vendor - TanStack Query (heavy dependency)
          if (id.includes('node_modules/@tanstack/react-query')) {
            return 'vendor-query'
          }

          // Vendor - Date utilities (date-fns can be large)
          if (id.includes('node_modules/date-fns')) {
            return 'vendor-date'
          }

          // Vendor - UI Utilities (Lucide icons, class utilities)
          if (
            id.includes('node_modules/lucide-react') ||
            id.includes('node_modules/class-variance-authority') ||
            id.includes('node_modules/clsx') ||
            id.includes('node_modules/tailwind-merge')
          ) {
            return 'vendor-ui-utils'
          }

          // All other node_modules
          if (id.includes('node_modules')) {
            return 'vendor-other'
          }
        },

        // Asset file naming
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name?.split('.')
          const extType = info?.[info.length - 1]

          if (/\.(png|jpe?g|svg|gif|tiff|bmp|ico)$/i.test(assetInfo.name ?? '')) {
            return 'assets/images/[name]-[hash][extname]'
          }

          if (/\.(woff2?|eot|ttf|otf)$/i.test(assetInfo.name ?? '')) {
            return 'assets/fonts/[name]-[hash][extname]'
          }

          return `assets/${extType}/[name]-[hash][extname]`
        },

        // Chunk file naming
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
      },

      // Tree shaking configuration
      treeshake: {
        moduleSideEffects: 'no-external', // Assume no side effects in node_modules
        propertyReadSideEffects: false,
        unknownGlobalSideEffects: false,
      },
    },

    // Optimize dependencies
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true,
    },
  },

  // Optimize dependencies pre-bundling
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      '@tanstack/react-query',
      'date-fns',
      'lucide-react',
    ],
    exclude: ['@anthropic-ai/sdk'], // Exclude if causing issues
  },

  // Server configuration (for development)
  server: {
    port: 5173,
    strictPort: false,
    host: true,
  },

  // Preview configuration
  preview: {
    port: 4173,
    strictPort: false,
    host: true,
  },
})
