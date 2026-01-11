// Preload script for Electron
// This script runs in a secure context with access to both Node.js and DOM APIs

const { contextBridge } = require('electron');

// Expose protected methods that allow the renderer process to use
// Node.js features in a secure way
contextBridge.exposeInMainWorld('electron', {
  // You can expose specific APIs here if needed
  // For this app, we're using browser-based APIs only
});

// Note: With contextIsolation enabled, the renderer process uses browser APIs
// Socket.io and fetch work normally via the CDN and HTTP requests
