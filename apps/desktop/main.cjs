const path = require('path');
const fs = require('fs');
const http = require('http');
const express = require('express');
const { app, BrowserWindow, shell, session } = require('electron');
const { createProxyMiddleware } = require('http-proxy-middleware');

const DEFAULT_BACKEND_URL = 'https://masq.onrender.com';
const WINDOWS_TITLEBAR_HEIGHT = 36;
const API_PREFIXES = [
  '/api',
  '/auth',
  '/me',
  '/masks',
  '/uploads',
  '/dm',
  '/rooms',
  '/friends',
  '/servers',
  '/channels',
  '/rtc',
];

const matchesApiPath = (pathname) => {
  if (pathname === '/ws' || pathname.startsWith('/ws/')) {
    return true;
  }

  return API_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
};

const isDocumentNavigationRequest = (req) => {
  const accept = typeof req.headers.accept === 'string' ? req.headers.accept : '';
  const fetchDest = typeof req.headers['sec-fetch-dest'] === 'string' ? req.headers['sec-fetch-dest'] : '';
  const fetchMode = typeof req.headers['sec-fetch-mode'] === 'string' ? req.headers['sec-fetch-mode'] : '';
  const upgradeInsecureRequests =
    typeof req.headers['upgrade-insecure-requests'] === 'string'
      ? req.headers['upgrade-insecure-requests']
      : '';

  return (
    req.method === 'GET' &&
    (accept.includes('text/html') ||
      fetchDest === 'document' ||
      fetchMode === 'navigate' ||
      upgradeInsecureRequests === '1')
  );
};

let windowRef = null;
let localServer = null;

const resolveAppIconPath = () => {
  const candidates = [
    path.join(__dirname, 'web-dist', 'icon.png'),
    path.join(__dirname, '..', 'web-dist', 'icon.png'),
    path.join(__dirname, '..', '..', 'web', 'public', 'icon.png'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return undefined;
};

const resolveWebDistPath = () => {
  const candidates = [
    path.join(__dirname, 'web-dist'),
    path.join(__dirname, '..', 'web-dist'),
    path.join(__dirname, '..', '..', 'web', 'dist'),
  ];

  for (const candidate of candidates) {
    try {
      const stat = fs.statSync(candidate);
      if (stat.isDirectory()) {
        return candidate;
      }
    } catch {
      // keep looking
    }
  }

  throw new Error('Unable to locate built web assets for desktop shell');
};

const buildLocalHostServer = async () => {
  const webDistPath = resolveWebDistPath();
  const backendUrl = process.env.MASQ_BACKEND_URL || DEFAULT_BACKEND_URL;

  const webApp = express();
  const proxy = createProxyMiddleware({
    target: backendUrl,
    changeOrigin: true,
    ws: true,
    xfwd: true,
    secure: true,
    logLevel: 'warn',
    pathFilter: (pathname, req) =>
      matchesApiPath(pathname) && !isDocumentNavigationRequest(req),
  });

  webApp.use(express.static(webDistPath, { index: false }));
  webApp.use(proxy);

  webApp.get('*', (_request, response) => {
    response.sendFile(path.join(webDistPath, 'index.html'));
  });

  const server = http.createServer(webApp);
  server.on('upgrade', (request, socket, head) => {
    if (!request.url || !request.url.startsWith('/ws')) {
      socket.destroy();
      return;
    }
    proxy.upgrade(request, socket, head);
  });

  await new Promise((resolve) => {
    server.listen(0, 'localhost', resolve);
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Unable to determine local server address');
  }

  return {
    server,
    url: `http://localhost:${address.port}`,
  };
};

const configureMediaPermissions = () => {
  const allowed = new Set([
    'media',
    'display-capture',
    'fullscreen',
    'clipboard-read',
    'clipboard-sanitized-write',
  ]);

  session.defaultSession.setPermissionRequestHandler((_contents, permission, callback) => {
    callback(allowed.has(permission));
  });
};

const createMainWindow = async () => {
  const { server, url } = await buildLocalHostServer();
  localServer = server;
  const iconPath = resolveAppIconPath();
  const isWindows = process.platform === 'win32';

  windowRef = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1160,
    minHeight: 720,
    backgroundColor: '#0b1323',
    autoHideMenuBar: true,
    icon: iconPath,
    titleBarStyle: isWindows ? 'hidden' : 'default',
    titleBarOverlay: isWindows
      ? {
          color: '#0b1323',
          symbolColor: '#e2e8f0',
          height: WINDOWS_TITLEBAR_HEIGHT,
        }
      : false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  windowRef.webContents.setWindowOpenHandler(({ url: externalUrl }) => {
    void shell.openExternal(externalUrl);
    return { action: 'deny' };
  });

  await windowRef.loadURL(`${url}?desktop=1`);

  if (isWindows) {
    await windowRef.webContents.insertCSS(`
      :root {
        --masq-titlebar-height: ${WINDOWS_TITLEBAR_HEIGHT}px;
      }

      body {
        padding-top: var(--masq-titlebar-height) !important;
        box-sizing: border-box;
      }

      body::before {
        content: '';
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        height: var(--masq-titlebar-height);
        background: #0b1323;
        border-bottom: 1px solid rgba(62, 84, 116, 0.45);
        -webkit-app-region: drag;
        z-index: 2147483647;
        pointer-events: auto;
      }
    `);
  }

  windowRef.on('closed', () => {
    windowRef = null;
  });
};

app.whenReady().then(async () => {
  configureMediaPermissions();
  await createMainWindow();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (!localServer) {
    return;
  }

  localServer.close();
  localServer = null;
});
