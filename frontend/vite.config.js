import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    // Work around malformed CKEditor sourcemap parsing during esbuild dep optimization.
    exclude: ['@ckeditor/ckeditor5-build-decoupled-document', 'ckeditor5'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    }
  },
  server: {
    proxy: {
      // Allow embedding PDFs in iframes from the Vite origin by proxying Django media/static.
      '/media': 'http://127.0.0.1:8000',
      '/static': 'http://127.0.0.1:8000',
    },
  },
});
