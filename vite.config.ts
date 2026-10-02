import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'


function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

export default defineConfig({
  plugins: [
    figmaAssetResolver(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/app'),
    },
  },
  build: {
    // Vite's default build output directory for hashed JS/CSS chunks is
    // "assets" (dist/assets/*) — this app also has its own page route at
    // /assets (the Assets inventory module). On a hard refresh at that
    // route, a static host resolves /assets against the build's own
    // assets directory before falling back to index.html, so the browser
    // gets back a raw .js chunk's source instead of the app shell. Renamed
    // to avoid the collision; the page's own URL (/assets) is unaffected.
    assetsDir: 'build-assets',
  },
})
