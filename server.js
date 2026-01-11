const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const { pool, testConnection } = require('./db');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:*',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:*',
  credentials: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Rate limiting configuration
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: 'Too many authentication attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to all API routes
app.use('/api/', apiLimiter);

// Store active socket connections
const activeUsers = new Map(); // userId -> socketId
const socketUsers = new Map(); // socketId -> userId

// Test database connection on startup
testConnection();

// API Routes

// Register new user
app.post('/api/register', authLimiter, async (req, res) => {
  try {
    const { username, password, email } = req.body;

    if (!username || !password || !email) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user into database
    const [result] = await pool.query(
      'INSERT INTO users (username, password, email) VALUES (?, ?, ?)',
      [username, hashedPassword, email]
    );

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      userId: result.insertId
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Username or email already exists' });
    }
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login user
app.post('/api/login', authLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Get user from database
    const [users] = await pool.query(
      'SELECT * FROM users WHERE username = ?',
      [username]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const user = users[0];

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Update user status to online
    await pool.query(
      'UPDATE users SET status = ?, last_seen = NOW() WHERE id = ?',
      ['online', user.id]
    );

    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get all users
app.get('/api/users', async (req, res) => {
  try {
    const [users] = await pool.query(
      'SELECT id, username, email, status, last_seen FROM users ORDER BY username'
    );
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get chat history between two users
app.get('/api/messages/:userId/:otherUserId', async (req, res) => {
  try {
    const { userId, otherUserId } = req.params;

    const [messages] = await pool.query(
      `SELECT m.*, 
        u1.username as sender_username,
        u2.username as receiver_username
      FROM messages m
      JOIN users u1 ON m.sender_id = u1.id
      JOIN users u2 ON m.receiver_id = u2.id
      WHERE (m.sender_id = ? AND m.receiver_id = ?) 
         OR (m.sender_id = ? AND m.receiver_id = ?)
      ORDER BY m.timestamp ASC`,
      [userId, otherUserId, otherUserId, userId]
    );

    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Logout user
app.post('/api/logout', async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Update user status to offline
    await pool.query(
      'UPDATE users SET status = ?, last_seen = NOW() WHERE id = ?',
      ['offline', userId]
    );

    res.json({ success: true, message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Socket.IO Connection Handling
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // User joins (authenticate)
  socket.on('user-join', async (userId) => {
    try {
      socketUsers.set(socket.id, userId);
      activeUsers.set(userId, socket.id);

      // Update user status to online
      await pool.query(
        'UPDATE users SET status = ?, last_seen = NOW() WHERE id = ?',
        ['online', userId]
      );

      // Broadcast to all clients that user is online
      io.emit('user-status-change', { userId, status: 'online' });

      console.log(`User ${userId} joined`);
    } catch (error) {
      console.error('Error in user-join:', error);
    }
  });

  // Send private message
  socket.on('private-message', async (data) => {
    try {
      const { senderId, receiverId, message } = data;

      // Save message to database
      const [result] = await pool.query(
        'INSERT INTO messages (sender_id, receiver_id, message) VALUES (?, ?, ?)',
        [senderId, receiverId, message]
      );

      const messageData = {
        id: result.insertId,
        sender_id: senderId,
        receiver_id: receiverId,
        message: message,
        timestamp: new Date(),
        is_read: false
      };

      // Send to receiver if online
      const receiverSocketId = activeUsers.get(receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('private-message', messageData);
      }

      // Send confirmation to sender
      socket.emit('message-sent', messageData);

      console.log(`Message from ${senderId} to ${receiverId}`);
    } catch (error) {
      console.error('Error sending message:', error);
      socket.emit('message-error', { error: 'Failed to send message' });
    }
  });

  // User is typing
  socket.on('typing', (data) => {
    const { receiverId, senderId } = data;
    const receiverSocketId = activeUsers.get(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('user-typing', { userId: senderId });
    }
  });

  // User stopped typing
  socket.on('stop-typing', (data) => {
    const { receiverId, senderId } = data;
    const receiverSocketId = activeUsers.get(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('user-stop-typing', { userId: senderId });
    }
  });

  // Handle disconnect
  socket.on('disconnect', async () => {
    try {
      const userId = socketUsers.get(socket.id);
      if (userId) {
        activeUsers.delete(userId);
        socketUsers.delete(socket.id);

        // Update user status to offline
        await pool.query(
          'UPDATE users SET status = ?, last_seen = NOW() WHERE id = ?',
          ['offline', userId]
        );

        // Broadcast to all clients that user is offline
        io.emit('user-status-change', { userId, status: 'offline' });

        console.log(`User ${userId} disconnected`);
      }
    } catch (error) {
      console.error('Error in disconnect:', error);
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`✓ Server running on port ${PORT}`);
});

module.exports = { app, server, io };
