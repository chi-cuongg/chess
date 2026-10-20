const { app, BrowserWindow, protocol, net } = require('electron');
const path = require('path');
const url = require('url');

let mainWindow = null;

// Register a privileged "app://" scheme so the renderer has a real, stable
// origin. This lets a strict Content-Security-Policy (see index.html) work
// correctly instead of the opaque origin used by file:// URLs.
protocol.registerSchemesAsPrivileged([
    {
        scheme: 'app',
        privileges: {
            standard: true,
            secure: true,
            supportFetchAPI: true,
            stream: true
        }
    }
]);

const ROOT = __dirname;

function resolveAppPath(pathname) {
    const decoded = decodeURIComponent(pathname || '/index.html');
    const resolved = path.normalize(path.join(ROOT, decoded));
    // Prevent path traversal outside the application directory.
    if (!resolved.startsWith(ROOT)) return null;
    return resolved;
}

function registerAppProtocol() {
    protocol.handle('app', async (request) => {
        const parsed = new URL(request.url);
        if (parsed.hostname !== 'bundle') {
            return new Response('Not found', { status: 404 });
        }

        const filePath = resolveAppPath(parsed.pathname);
        if (!filePath) {
            return new Response('Forbidden', { status: 403 });
        }

        try {
            return await net.fetch(url.pathToFileURL(filePath).toString());
        } catch (err) {
            return new Response('Not found', { status: 404 });
        }
    });
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 800,
        minWidth: 800,
        minHeight: 700,
        webPreferences: {
            // Renderer only uses browser APIs (no Node), so keep it isolated.
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true
        },
        autoHideMenuBar: true,
        backgroundColor: '#1a1a2e',
        show: false
    });

    mainWindow.loadURL('app://bundle/index.html');

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(() => {
    registerAppProtocol();
    createWindow();

    app.on('activate', () => {
        if (mainWindow === null) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
