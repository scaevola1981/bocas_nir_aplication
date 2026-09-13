const { app, BrowserWindow, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');

app.setName('Bocas Gestiune NIR');

function startEmbeddedServer() {
  return new Promise((resolve) => {
    // Verifică dacă există deja server Vite pornit pe 3000
    const testReq = http.get('http://localhost:3000/api/excel', (res) => {
      resolve(3000);
    });

    testReq.on('error', () => {
      // Pornim serverul intern autonom pentru aplicația împachetată pe Windows/Mac
      const server = http.createServer((req, res) => {
        // CORS headers pentru acces local
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
          res.writeHead(200);
          return res.end();
        }

        const url = new URL(req.url, 'http://localhost');

        if (url.pathname === '/api/excel') {
          // Caută Document de lucru.xlsx pe Desktop-ul utilizatorului (Windows sau Mac)
          let desktopPath = '';
          try {
            desktopPath = path.join(app.getPath('desktop'), 'Document de lucru.xlsx');
          } catch (e) {
            desktopPath = path.resolve(process.cwd(), 'Document de lucru.xlsx');
          }

          let filePath = fs.existsSync(desktopPath) ? desktopPath : path.resolve(process.cwd(), 'Document de lucru.xlsx');

          if (req.method === 'GET') {
            if (fs.existsSync(filePath)) {
              const data = fs.readFileSync(filePath);
              res.writeHead(200, {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': 'inline; filename="Document de lucru.xlsx"'
              });
              return res.end(data);
            } else {
              res.writeHead(404);
              return res.end(JSON.stringify({ error: 'Fișierul nu a fost găsit pe Desktop.' }));
            }
          } else if (req.method === 'POST') {
            const chunks = [];
            req.on('data', (c) => chunks.push(c));
            req.on('end', () => {
              const buf = Buffer.concat(chunks);
              // Salvează direct pe Desktop
              fs.writeFileSync(filePath, buf);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              return res.end(JSON.stringify({ success: true, savedDirectly: true, fileName: 'Document de lucru.xlsx' }));
            });
            return;
          }
        }

        // Servire fișiere din folderul dist/
        let relPath = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
        const diskFile = path.join(__dirname, '../dist', relPath);

        if (fs.existsSync(diskFile) && !fs.statSync(diskFile).isDirectory()) {
          const ext = path.extname(diskFile);
          const mimeTypes = {
            '.html': 'text/html',
            '.js': 'application/javascript',
            '.css': 'text/css',
            '.png': 'image/png',
            '.ico': 'image/x-icon',
            '.svg': 'image/svg+xml',
            '.json': 'application/json'
          };
          res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
          return res.end(fs.readFileSync(diskFile));
        }

        res.writeHead(404);
        res.end();
      });

      server.listen(3000, () => {
        resolve(3000);
      });

      server.on('error', () => {
        server.listen(0, () => {
          resolve(server.address().port);
        });
      });
    });
  });
}

async function createWindow() {
  const port = await startEmbeddedServer();

  const iconPath = process.platform === 'win32'
    ? path.join(__dirname, '../public/icon.ico')
    : path.join(__dirname, '../public/app-icon.png');

  if (process.platform === 'darwin' && app.dock) {
    try {
      const image = nativeImage.createFromPath(iconPath);
      app.dock.setIcon(image);
    } catch (err) {
      console.error('Eroare setare iconiță dock:', err);
    }
  }

  const win = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Gestiune e-Factură & NIR - Bocas Project SRL',
    icon: iconPath,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    },
    autoHideMenuBar: true
  });

  win.loadURL(`http://localhost:${port}`);
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

