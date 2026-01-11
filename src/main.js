const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let serverProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    backgroundColor: '#1a1a1a',
    show: false
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open DevTools in development
  // mainWindow.webContents.openDevTools();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function startServer() {
  return new Promise((resolve, reject) => {
    const serverPath = path.join(__dirname, 'server', 'server.js');
    const http = require('http');
    
    serverProcess = spawn('node', [serverPath], {
      stdio: 'pipe',
      env: { ...process.env, PORT: process.env.PORT || '3000' }
    });

    serverProcess.on('error', (error) => {
      console.error('Failed to start server:', error);
      reject(error);
    });

    // Listen for server output to detect when it's ready
    let serverStarted = false;
    const serverPort = process.env.PORT || 3000;
    
    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log('Server:', output);
      
      if (!serverStarted && output.includes('Server running')) {
        serverStarted = true;
        resolve();
      }
    });

    serverProcess.stderr.on('data', (data) => {
      console.error('Server error:', data.toString());
    });

    // Fallback: Check if server is responsive after 3 seconds
    setTimeout(() => {
      if (!serverStarted) {
        const options = {
          host: 'localhost',
          port: serverPort,
          path: '/api/csrf-token',
          method: 'GET',
          timeout: 1000
        };

        const req = http.request(options, (res) => {
          if (res.statusCode === 200 || res.statusCode === 403) {
            serverStarted = true;
            resolve();
          }
        });

        req.on('error', () => {
          // Server not ready yet, but don't reject - it might still be starting
          if (!serverStarted) {
            console.warn('Server health check failed, but continuing...');
            resolve();
          }
        });

        req.end();
      }
    }, 3000);
  });
}

function stopServer() {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
}

app.whenReady().then(async () => {
  try {
    await startServer();
    createWindow();
  } catch (error) {
    console.error('Error starting application:', error);
    app.quit();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  stopServer();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopServer();
});

app.on('will-quit', () => {
  stopServer();
});
