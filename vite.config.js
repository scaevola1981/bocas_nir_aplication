import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      exceljs: 'exceljs/dist/exceljs.min.js',
      'pdfjs-dist': 'pdfjs-dist/build/pdf.min.js'
    }
  },
  server: {
    host: '127.0.0.1',
    port: 3000,
    open: true
  },
  preview: {
    host: '127.0.0.1',
    port: 3000,
    open: true
  },
  optimizeDeps: {
    include: ['exceljs', 'fast-xml-parser', 'pdfjs-dist']
  },
  build: {
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      onwarn(warning, warn) {
        // Ignoră avertismentul intern de eval din librăria externă pdfjs-dist
        if (warning.code === 'EVAL' && warning.id && warning.id.includes('pdfjs-dist')) {
          return;
        }
        warn(warning);
      }
    }
  }
});
