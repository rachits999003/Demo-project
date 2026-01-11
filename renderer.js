// API Configuration
const API_URL = 'http://localhost:3000';

// Global state
let currentUser = null;
let selectedUser = null;
let socket = null;
let users = [];
let typingTimeout = null;

// DOM Elements
const loginContainer = document.getElementById('login-container');
const registerContainer = document.getElementById('register-container');
const chatContainer = document.getElementById('chat-container');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const showRegisterLink = document.getElementById('show-register');
const showLoginLink = document.getElementById('show-login');
const loginError = document.getElementById('login-error');
const registerError = document.getElementById('register-error');
const logoutBtn = document.getElementById('logout-btn');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const messagesContainer = document.getElementById('messages-container');
const usersList = document.getElementById('users-list');
const chatWelcome = document.getElementById('chat-welcome');
const chatHeader = document.getElementById('chat-header');
const chatInputContainer = document.getElementById('chat-input-container');
const userSearch = document.getElementById('user-search');
const typingIndicator = document.getElementById('typing-indicator');

// Utility Functions
function showError(element, message) {
  element.textContent = message;
  element.classList.add('show');
  setTimeout(() => {
    element.classList.remove('show');
  }, 5000);
}

function hideError(element) {
  element.classList.remove('show');
  element.textContent = '';
}

function switchScreen(showContainer) {
  [loginContainer, registerContainer, chatContainer].forEach(container => {
    container.classList.remove('active');
  });
  showContainer.classList.add('active');
}

function getInitials(name) {
  return name ? name.charAt(0).toUpperCase() : 'U';
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) { // Less than 1 minute
    return 'Just now';
  } else if (diff < 3600000) { // Less than 1 hour
    const minutes = Math.floor(diff / 60000);
    return `${minutes} min ago`;
  } else if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}

// Authentication Functions
async function login(username, password) {
  try {
    const response = await fetch(`${API_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Login failed');
    }

    return data;
  } catch (error) {
    throw error;
  }
}

async function register(username, email, password) {
  try {
    const response = await fetch(`${API_URL}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Registration failed');
    }

    return data;
  } catch (error) {
    throw error;
  }
}

async function logout() {
  try {
    if (currentUser) {
      await fetch(`${API_URL}/api/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id })
      });
    }

    if (socket) {
      socket.disconnect();
      socket = null;
    }

    currentUser = null;
    selectedUser = null;
    switchScreen(loginContainer);
  } catch (error) {
    console.error('Logout error:', error);
  }
}

// User Functions
async function loadUsers() {
  try {
    const response = await fetch(`${API_URL}/api/users`);
    const data = await response.json();
    
    users = data.filter(u => u.id !== currentUser.id);
    renderUsers(users);
  } catch (error) {
    console.error('Error loading users:', error);
  }
}

function renderUsers(usersToRender) {
  usersList.innerHTML = '';
  
  usersToRender.forEach(user => {
    const userItem = document.createElement('div');
    userItem.className = 'user-item';
    if (selectedUser && selectedUser.id === user.id) {
      userItem.classList.add('active');
    }
    
    userItem.innerHTML = `
      <div class="user-avatar">${getInitials(user.username)}</div>
      <div class="user-item-info">
        <h4>${user.username}</h4>
        <p>
          <span class="status-indicator ${user.status}"></span>
          ${user.status === 'online' ? 'Online' : 'Offline'}
        </p>
      </div>
    `;
    
    userItem.addEventListener('click', () => selectUser(user));
    usersList.appendChild(userItem);
  });
}

function selectUser(user) {
  selectedUser = user;
  renderUsers(users);
  
  // Update chat header
  document.getElementById('chat-username').textContent = user.username;
  document.getElementById('chat-user-avatar').textContent = getInitials(user.username);
  document.getElementById('chat-user-status').textContent = user.status === 'online' ? 'Online' : 'Offline';
  
  // Show chat interface
  chatWelcome.style.display = 'none';
  chatHeader.style.display = 'block';
  messagesContainer.style.display = 'flex';
  chatInputContainer.style.display = 'block';
  
  // Load chat history
  loadChatHistory(user.id);
}

async function loadChatHistory(otherUserId) {
  try {
    const response = await fetch(`${API_URL}/api/messages/${currentUser.id}/${otherUserId}`);
    const messages = await response.json();
    
    messagesContainer.innerHTML = '';
    messages.forEach(msg => {
      displayMessage(msg, msg.sender_id === currentUser.id);
    });
    
    scrollToBottom();
  } catch (error) {
    console.error('Error loading chat history:', error);
  }
}

// Message Functions
function displayMessage(messageData, isSent) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${isSent ? 'sent' : 'received'}`;
  
  const avatarText = isSent ? getInitials(currentUser.username) : getInitials(selectedUser.username);
  
  messageDiv.innerHTML = `
    <div class="message-avatar">${avatarText}</div>
    <div class="message-content">
      <div class="message-text">${escapeHtml(messageData.message)}</div>
      <span class="message-time">${formatTime(messageData.timestamp)}</span>
    </div>
  `;
  
  messagesContainer.appendChild(messageDiv);
  scrollToBottom();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function scrollToBottom() {
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function sendMessage(message) {
  if (!message.trim() || !selectedUser) return;
  
  socket.emit('private-message', {
    senderId: currentUser.id,
    receiverId: selectedUser.id,
    message: message.trim()
  });
  
  messageInput.value = '';
  stopTyping();
}

function startTyping() {
  if (!selectedUser) return;
  
  socket.emit('typing', {
    senderId: currentUser.id,
    receiverId: selectedUser.id
  });
}

function stopTyping() {
  if (!selectedUser) return;
  
  socket.emit('stop-typing', {
    senderId: currentUser.id,
    receiverId: selectedUser.id
  });
}

// Socket.IO Functions
function initializeSocket() {
  socket = io(API_URL);
  
  socket.on('connect', () => {
    console.log('Connected to server');
    socket.emit('user-join', currentUser.id);
  });
  
  socket.on('disconnect', () => {
    console.log('Disconnected from server');
  });
  
  socket.on('private-message', (messageData) => {
    if (selectedUser && messageData.sender_id === selectedUser.id) {
      displayMessage(messageData, false);
    }
  });
  
  socket.on('message-sent', (messageData) => {
    displayMessage(messageData, true);
  });
  
  socket.on('user-status-change', ({ userId, status }) => {
    const user = users.find(u => u.id === userId);
    if (user) {
      user.status = status;
      renderUsers(users);
      
      if (selectedUser && selectedUser.id === userId) {
        document.getElementById('chat-user-status').textContent = status === 'online' ? 'Online' : 'Offline';
      }
    }
  });
  
  socket.on('user-typing', ({ userId }) => {
    if (selectedUser && userId === selectedUser.id) {
      typingIndicator.style.display = 'block';
    }
  });
  
  socket.on('user-stop-typing', ({ userId }) => {
    if (selectedUser && userId === selectedUser.id) {
      typingIndicator.style.display = 'none';
    }
  });
  
  socket.on('message-error', (data) => {
    console.error('Message error:', data.error);
  });
}

// Event Listeners
showRegisterLink.addEventListener('click', (e) => {
  e.preventDefault();
  hideError(loginError);
  switchScreen(registerContainer);
});

showLoginLink.addEventListener('click', (e) => {
  e.preventDefault();
  hideError(registerError);
  switchScreen(loginContainer);
});

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError(loginError);
  
  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;
  
  try {
    const result = await login(username, password);
    currentUser = result.user;
    
    // Update UI
    document.getElementById('current-username').textContent = currentUser.username;
    document.getElementById('current-user-avatar').textContent = getInitials(currentUser.username);
    
    // Initialize socket and load users
    initializeSocket();
    await loadUsers();
    
    switchScreen(chatContainer);
    loginForm.reset();
  } catch (error) {
    showError(loginError, error.message);
  }
});

registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError(registerError);
  
  const username = document.getElementById('register-username').value;
  const email = document.getElementById('register-email').value;
  const password = document.getElementById('register-password').value;
  
  try {
    await register(username, email, password);
    registerForm.reset();
    switchScreen(loginContainer);
    showError(loginError, 'Registration successful! Please login.');
    loginError.style.background = 'rgba(0, 217, 163, 0.1)';
    loginError.style.color = 'var(--success-color)';
    loginError.style.borderColor = 'rgba(0, 217, 163, 0.2)';
  } catch (error) {
    showError(registerError, error.message);
  }
});

logoutBtn.addEventListener('click', logout);

messageForm.addEventListener('submit', (e) => {
  e.preventDefault();
  sendMessage(messageInput.value);
});

messageInput.addEventListener('input', () => {
  if (typingTimeout) {
    clearTimeout(typingTimeout);
  }
  
  if (messageInput.value.trim()) {
    startTyping();
    typingTimeout = setTimeout(stopTyping, 2000);
  } else {
    stopTyping();
  }
});

userSearch.addEventListener('input', (e) => {
  const searchTerm = e.target.value.toLowerCase();
  const filteredUsers = users.filter(user => 
    user.username.toLowerCase().includes(searchTerm)
  );
  renderUsers(filteredUsers);
});

// Initialize app
window.addEventListener('load', () => {
  switchScreen(loginContainer);
});
