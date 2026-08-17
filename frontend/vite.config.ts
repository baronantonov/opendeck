import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Open Deck TMA: single-file build.
// The backend serves `index.html` via GET / and GitHub Pages also expects a root
// index.html, so we inline everything into one self-contained file.
export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile()],
  server: { host: true },
  build: {
    // singlefile already inlines; these keep the bundle deterministic and tiny
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 5000,
  },
});
