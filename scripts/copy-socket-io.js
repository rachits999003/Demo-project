#!/usr/bin/env node

// Script to copy Socket.io client library to renderer directory
const fs = require('fs');
const path = require('path');

const source = path.join(__dirname, '..', 'node_modules', 'socket.io-client', 'dist', 'socket.io.min.js');
const target = path.join(__dirname, '..', 'src', 'renderer', 'socket.io.min.js');

try {
  fs.copyFileSync(source, target);
  console.log('✓ Socket.io client copied successfully');
} catch (error) {
  console.error('✗ Failed to copy Socket.io client:', error.message);
  process.exit(1);
}
