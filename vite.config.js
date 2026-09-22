import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/',
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
    include: ['exceljs', 'fast-xml-parser'],
    exclude: ['pdfjs-dist']
  }
});
