import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

function localExcelPlugin() {
  return {
    name: 'local-excel-plugin',
    configureServer(server) {
      server.middlewares.use('/api/excel', (req, res, next) => {
        const filePath = path.resolve(process.cwd(), 'Document de lucru.xlsx');
        
        if (req.method === 'GET') {
          if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'inline; filename="Document de lucru.xlsx"');
            res.end(data);
          } else {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: 'Fisierul Document de lucru.xlsx nu a fost gasit.' }));
          }
        } else if (req.method === 'POST') {
          const chunks = [];
          req.on('data', chunk => chunks.push(chunk));
          req.on('end', () => {
            const buffer = Buffer.concat(chunks);
            fs.writeFileSync(filePath, buffer);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, savedDirectly: true, fileName: 'Document de lucru.xlsx' }));
          });
        } else {
          next();
        }
      });
    }
  };
}

export default defineConfig({
  base: '/',
  plugins: [react(), localExcelPlugin()],
  server: {
    port: 3000,
    open: true
  },
  optimizeDeps: {
    include: ['exceljs', 'pdfjs-dist', 'fast-xml-parser']
  }
});
