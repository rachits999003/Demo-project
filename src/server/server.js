const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const session = require('express-session');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'electron-chat-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

// Database connection pool
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'electron_chat',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

let pool;

async function initializeDatabase() {
  try {
    pool = mysql.createPool(dbConfig);
    const connection = await pool.getConnection();
    console.log('✓ Database connected successfully');
    connection.release();
  } catch (error) {
    console.error('✗ Database connection failed:', error.message);
    console.log('Please ensure MySQL is running and the database is created using database/schema.sql');
  }
}

// Initialize database connection
initializeDatabase();

// Authentication endpoints
app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    if (username.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user
    const [result] = await pool.execute(
      'INSERT INTO users (username, password) VALUES (?, ?)',
      [username, hashedPassword]
    );

    res.json({ success: true, message: 'Registration successful', userId: result.insertId });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ error: 'Username already exists' });
    } else {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Find user
    const [users] = await pool.execute(
      'SELECT id, username, password FROM users WHERE username = ?',
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

    // Update last login
    await pool.execute(
      'UPDATE users SET last_login = NOW() WHERE id = ?',
      [user.id]
    );

    // Set session
    req.session.userId = user.id;
    req.session.username = user.username;

    res.json({ 
      success: true, 
      message: 'Login successful',
      user: { id: user.id, username: user.username }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true, message: 'Logged out successfully' });
});

// Get all users except current user
app.get('/api/users', async (req, res) => {
  try {
    const currentUserId = req.query.currentUserId;
    
    const [users] = await pool.execute(
      'SELECT id, username, created_at, last_login FROM users WHERE id != ? ORDER BY username',
      [currentUserId || 0]
    );

    res.json({ success: true, users });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get chat history between two users
app.get('/api/messages', async (req, res) => {
  try {
    const { userId1, userId2 } = req.query;

    const [messages] = await pool.execute(
      `SELECT m.id, m.sender_id, m.receiver_id, m.message, m.sent_at, m.is_read,
              s.username as sender_username, r.username as receiver_username
       FROM messages m
       JOIN users s ON m.sender_id = s.id
       JOIN users r ON m.receiver_id = r.id
       WHERE (m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?)
       ORDER BY m.sent_at ASC`,
      [userId1, userId2, userId2, userId1]
    );

    res.json({ success: true, messages });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Socket.io connection handling
const connectedUsers = new Map(); // userId -> socketId

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // User authentication
  socket.on('authenticate', (userId) => {
    connectedUsers.set(userId, socket.id);
    socket.userId = userId;
    console.log(`User ${userId} authenticated with socket ${socket.id}`);

    // Broadcast updated user list
    io.emit('user-status-changed');
  });

  // Handle private messages
  socket.on('private-message', async (data) => {
    try {
      const { senderId, receiverId, message } = data;

      // Save message to database
      const [result] = await pool.execute(
        'INSERT INTO messages (sender_id, receiver_id, message) VALUES (?, ?, ?)',
        [senderId, receiverId, message]
      );

      const messageData = {
        id: result.insertId,
        sender_id: senderId,
        receiver_id: receiverId,
        message: message,
        sent_at: new Date().toISOString()
      };

      // Send to receiver if online
      const receiverSocketId = connectedUsers.get(receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('private-message', messageData);
      }

      // Send confirmation back to sender
      socket.emit('message-sent', messageData);
    } catch (error) {
      console.error('Error sending message:', error);
      socket.emit('message-error', { error: 'Failed to send message' });
    }
  });

  // Handle typing indicator
  socket.on('typing', (data) => {
    const { receiverId, isTyping } = data;
    const receiverSocketId = connectedUsers.get(receiverId);
    
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('user-typing', {
        userId: socket.userId,
        isTyping
      });
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    if (socket.userId) {
      connectedUsers.delete(socket.userId);
      console.log(`User ${socket.userId} disconnected`);
      
      // Broadcast updated user list
      io.emit('user-status-changed');
    }
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✓ Server running on port ${PORT}`);
  console.log(`✓ Socket.io enabled for real-time messaging`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing server...');
  server.close(() => {
    console.log('Server closed');
    if (pool) {
      pool.end();
    }
    process.exit(0);
  });
});
