const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');

// Validate required environment variables in production
if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
  console.error('ERROR: SESSION_SECRET environment variable must be set in production');
  process.exit(1);
}

const app = express();
const server = http.createServer(app);

// Session configuration
const sessionSecret = process.env.SESSION_SECRET || (() => {
  const randomSecret = crypto.randomBytes(32).toString('hex');
  console.warn('WARNING: Using randomly generated session secret. Set SESSION_SECRET environment variable for production.');
  return randomSecret;
})();

const sessionMiddleware = session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'strict'
  }
});

const io = socketIo(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ["http://localhost:3000"],
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Share session with Socket.io
io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, next);
});

// Rate limiting configuration
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // Limit each IP to 30 requests per windowMs
  message: 'Too many requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(sessionMiddleware);

// Custom CSRF protection using double-submit cookie pattern
function generateCsrfToken() {
  return crypto.randomBytes(32).toString('hex');
}

function csrfProtection(req, res, next) {
  // GET requests don't need CSRF validation
  if (req.method === 'GET') {
    return next();
  }

  const tokenFromHeader = req.headers['csrf-token'] || req.headers['x-csrf-token'];
  const tokenFromSession = req.session.csrfToken;

  if (!tokenFromHeader || !tokenFromSession || tokenFromHeader !== tokenFromSession) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }

  next();
}

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

// Authentication middleware
function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

// CSRF token endpoint
app.get('/api/csrf-token', (req, res) => {
  // Generate and store CSRF token in session
  const token = generateCsrfToken();
  req.session.csrfToken = token;
  res.json({ csrfToken: token });
});

// Authentication endpoints
app.post('/api/register', authLimiter, csrfProtection, async (req, res) => {
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

app.post('/api/login', authLimiter, csrfProtection, async (req, res) => {
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

app.post('/api/logout', requireAuth, csrfProtection, (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Session destruction error:', err);
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ success: true, message: 'Logged out successfully' });
  });
});

// Get all users except current user
app.get('/api/users', requireAuth, apiLimiter, async (req, res) => {
  try {
    // Use session userId instead of query parameter
    const currentUserId = req.session.userId;
    
    const [users] = await pool.execute(
      'SELECT id, username, created_at, last_login FROM users WHERE id != ? ORDER BY username',
      [currentUserId]
    );

    res.json({ success: true, users });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get chat history between two users
app.get('/api/messages', requireAuth, apiLimiter, async (req, res) => {
  try {
    const currentUserId = req.session.userId;
    const { otherUserId } = req.query;

    // Verify the current user is part of this conversation
    if (!otherUserId) {
      return res.status(400).json({ error: 'otherUserId is required' });
    }

    const [messages] = await pool.execute(
      `SELECT m.id, m.sender_id, m.receiver_id, m.message, m.sent_at, m.is_read,
              s.username as sender_username, r.username as receiver_username
       FROM messages m
       JOIN users s ON m.sender_id = s.id
       JOIN users r ON m.receiver_id = r.id
       WHERE (m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?)
       ORDER BY m.sent_at DESC
       LIMIT 100`,
      [currentUserId, otherUserId, otherUserId, currentUserId]
    );

    // Reverse to show oldest first (limited to last 100 messages)
    messages.reverse();

    res.json({ success: true, messages });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Socket.io connection handling
const connectedUsers = new Map(); // userId -> socketId
const validUserIds = new Set(); // Cache of valid user IDs

// Helper function to validate and cache user IDs
async function isValidUserId(userId) {
  if (validUserIds.has(userId)) {
    return true;
  }
  
  try {
    const [users] = await pool.execute('SELECT id FROM users WHERE id = ?', [userId]);
    if (users.length > 0) {
      validUserIds.add(userId);
      return true;
    }
  } catch (error) {
    console.error('User validation error:', error);
  }
  
  return false;
}

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Get session from socket
  const session = socket.request.session;

  // Check if user is authenticated via session
  if (!session || !session.userId) {
    console.log('Unauthenticated socket connection attempt');
    socket.disconnect(true);
    return;
  }

  // Set authenticated user ID from session
  socket.userId = session.userId;
  connectedUsers.set(socket.userId, socket.id);
  console.log(`User ${socket.userId} connected with socket ${socket.id}`);

  // Broadcast updated user list
  io.emit('user-status-changed');

  // Handle private messages
  socket.on('private-message', async (data) => {
    try {
      const { senderId, receiverId, message } = data;

      // Validate that the senderId matches the authenticated socket user
      if (socket.userId !== senderId) {
        console.error(`Authentication mismatch: socket.userId=${socket.userId}, senderId=${senderId}`);
        socket.emit('message-error', { error: 'Authentication error' });
        return;
      }

      // Validate receiverId exists (with caching)
      const isValid = await isValidUserId(receiverId);
      
      if (!isValid) {
        socket.emit('message-error', { error: 'Invalid receiver' });
        return;
      }

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
    // Validate socket is authenticated
    if (!socket.userId) {
      return;
    }

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
