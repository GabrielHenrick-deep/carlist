import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      workbox: {
        // Decodificador Draco em JS puro (719 KB) só serve a navegadores sem WebAssembly.
        globIgnores: ['**/draco_decoder-*.js'],
        runtimeCaching: [
          {
            // Modelo 3D (~7 MB): baixado uma vez e guardado para uso offline.
            urlPattern: ({ url }) => url.pathname.endsWith('.glb'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'carlist-models',
              cacheableResponse: { statuses: [200] },
              expiration: { maxEntries: 4 },
            },
          },
          {
            // Decodificador WebAssembly (nome com hash, nunca muda).
            urlPattern: ({ url }) => url.pathname.endsWith('.wasm'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'carlist-wasm',
              cacheableResponse: { statuses: [200] },
              expiration: { maxEntries: 4 },
            },
          },
        ],
      },
      manifest: {
        name: 'CarList - Meu Carro',
        short_name: 'CarList',
        description: 'Manutenções, abastecimentos e gastos do meu carro',
        lang: 'pt-BR',
        theme_color: '#0369a1',
        background_color: '#f1f5f9',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
})
