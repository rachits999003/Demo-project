// Application State
const state = {
    currentUser: null,
    selectedUser: null,
    users: [],
    socket: null,
    typingTimeout: null,
    csrfToken: null
};

// API Base URL - from electron config or fallback to localhost
const API_BASE = (window.electron && window.electron.apiBase) || 'http://localhost:3000';

// Initialize CSRF token
async function initializeCsrfToken() {
    try {
        const response = await fetch(`${API_BASE}/api/csrf-token`, {
            credentials: 'include'
        });
        const data = await response.json();
        state.csrfToken = data.csrfToken;
    } catch (error) {
        console.error('Failed to get CSRF token:', error);
    }
}

// DOM Elements
const authContainer = document.getElementById('auth-container');
const chatContainer = document.getElementById('chat-container');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const loginError = document.getElementById('login-error');
const registerError = document.getElementById('register-error');
const currentUsername = document.getElementById('current-username');
const currentUserAvatar = document.getElementById('current-user-avatar');
const logoutBtn = document.getElementById('logout-btn');
const userList = document.getElementById('user-list');
const userSearch = document.getElementById('user-search');
const noChatSelected = document.getElementById('no-chat-selected');
const chatView = document.getElementById('chat-view');
const chatUsername = document.getElementById('chat-username');
const chatUserAvatar = document.getElementById('chat-user-avatar');
const messagesContainer = document.getElementById('messages-container');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const typingIndicator = document.getElementById('typing-indicator');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await initializeCsrfToken();
    setupEventListeners();
    showAuthScreen();
});

// Event Listeners
function setupEventListeners() {
    // Auth tabs
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', () => {
            const tab = button.dataset.tab;
            switchAuthTab(tab);
        });
    });

    // Forms
    loginForm.addEventListener('submit', handleLogin);
    registerForm.addEventListener('submit', handleRegister);
    logoutBtn.addEventListener('click', handleLogout);
    messageForm.addEventListener('submit', handleSendMessage);

    // User search
    userSearch.addEventListener('input', handleUserSearch);

    // Typing indicator
    messageInput.addEventListener('input', handleTyping);
}

function switchAuthTab(tab) {
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(form => form.classList.remove('active'));
    
    document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
    document.getElementById(`${tab}-form`).classList.add('active');
    
    // Clear errors
    loginError.classList.remove('show');
    registerError.classList.remove('show');
}

// Authentication
async function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;

    try {
        const response = await fetch(`${API_BASE}/api/login`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'CSRF-Token': state.csrfToken
            },
            credentials: 'include',
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            state.currentUser = data.user;
            initializeChat();
        } else {
            showError(loginError, data.error);
        }
    } catch (error) {
        showError(loginError, 'Connection failed. Please ensure the server is running.');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    
    const username = document.getElementById('register-username').value;
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-password-confirm').value;

    if (password !== confirmPassword) {
        showError(registerError, 'Passwords do not match');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/register`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'CSRF-Token': state.csrfToken
            },
            credentials: 'include',
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            showError(registerError, 'Registration successful! Please login.', 'success');
            setTimeout(() => {
                switchAuthTab('login');
                document.getElementById('login-username').value = username;
            }, 1500);
        } else {
            showError(registerError, data.error);
        }
    } catch (error) {
        showError(registerError, 'Connection failed. Please ensure the server is running.');
    }
}

async function handleLogout() {
    try {
        await fetch(`${API_BASE}/api/logout`, { 
            method: 'POST',
            headers: {
                'CSRF-Token': state.csrfToken
            },
            credentials: 'include'
        });
    } catch (error) {
        console.error('Logout error:', error);
    }

    if (state.socket) {
        state.socket.disconnect();
    }

    state.currentUser = null;
    state.selectedUser = null;
    state.users = [];

    showAuthScreen();
}

// UI Control
function showAuthScreen() {
    authContainer.classList.add('active');
    chatContainer.classList.remove('active');
    
    // Clear forms
    loginForm.reset();
    registerForm.reset();
    loginError.classList.remove('show');
    registerError.classList.remove('show');
}

function showChatScreen() {
    authContainer.classList.remove('active');
    chatContainer.classList.add('active');
}

function showError(element, message, type = 'error') {
    element.textContent = message;
    element.classList.add('show');
    if (type === 'success') {
        element.style.backgroundColor = 'rgba(80, 250, 123, 0.1)';
        element.style.borderColor = 'var(--success-color)';
        element.style.color = 'var(--success-color)';
    } else {
        element.style.backgroundColor = 'rgba(255, 85, 85, 0.1)';
        element.style.borderColor = 'var(--error-color)';
        element.style.color = 'var(--error-color)';
    }
}

// Chat Initialization
async function initializeChat() {
    showChatScreen();
    
    currentUsername.textContent = state.currentUser.username;
    currentUserAvatar.textContent = state.currentUser.username.charAt(0).toUpperCase();

    // Initialize Socket.io with credentials for session sharing
    state.socket = io(API_BASE, {
        withCredentials: true
    });
    
    state.socket.on('connect', () => {
        console.log('Connected to server');
        // Session-based authentication, no manual authenticate needed
    });

    state.socket.on('private-message', (message) => {
        if (state.selectedUser && 
            (message.sender_id === state.selectedUser.id || message.receiver_id === state.selectedUser.id)) {
            displayMessage(message);
        }
    });

    state.socket.on('user-typing', (data) => {
        if (state.selectedUser && data.userId === state.selectedUser.id) {
            typingIndicator.classList.add('show');
            setTimeout(() => {
                typingIndicator.classList.remove('show');
            }, 3000);
        }
    });

    state.socket.on('user-status-changed', () => {
        loadUsers();
    });

    state.socket.on('message-sent', (message) => {
        if (state.selectedUser && 
            (message.sender_id === state.currentUser.id && message.receiver_id === state.selectedUser.id)) {
            displayMessage(message);
        }
    });

    // Load users
    await loadUsers();
}

// User Management
async function loadUsers() {
    try {
        const response = await fetch(`${API_BASE}/api/users`, {
            credentials: 'include'
        });
        const data = await response.json();

        if (data.success) {
            state.users = data.users;
            renderUserList();
        }
    } catch (error) {
        console.error('Failed to load users:', error);
    }
}

function renderUserList(filter = '') {
    userList.innerHTML = '';

    const filteredUsers = state.users.filter(user => 
        user.username.toLowerCase().includes(filter.toLowerCase())
    );

    filteredUsers.forEach(user => {
        const userItem = document.createElement('div');
        userItem.className = 'user-item';
        if (state.selectedUser && state.selectedUser.id === user.id) {
            userItem.classList.add('active');
        }

        userItem.innerHTML = `
            <div class="avatar">
                <span>${user.username.charAt(0).toUpperCase()}</span>
            </div>
            <div class="user-item-info">
                <div class="user-item-name">${user.username}</div>
                <div class="user-item-status">Click to chat</div>
            </div>
        `;

        userItem.addEventListener('click', () => selectUser(user));
        userList.appendChild(userItem);
    });
}

function handleUserSearch(e) {
    renderUserList(e.target.value);
}

async function selectUser(user) {
    state.selectedUser = user;
    
    // Update UI
    renderUserList(userSearch.value);
    noChatSelected.style.display = 'none';
    chatView.classList.add('active');
    
    chatUsername.textContent = user.username;
    chatUserAvatar.textContent = user.username.charAt(0).toUpperCase();
    
    // Load chat history
    await loadChatHistory();
    
    // Focus input
    messageInput.focus();
}

// Message Management
async function loadChatHistory() {
    try {
        const response = await fetch(
            `${API_BASE}/api/messages?otherUserId=${state.selectedUser.id}`,
            {
                credentials: 'include'
            }
        );
        const data = await response.json();

        if (data.success) {
            messagesContainer.innerHTML = '';
            data.messages.forEach(message => {
                displayMessage(message);
            });
            scrollToBottom();
        }
    } catch (error) {
        console.error('Failed to load chat history:', error);
    }
}

function displayMessage(message) {
    const messageDiv = document.createElement('div');
    const isSent = message.sender_id === state.currentUser.id;
    
    messageDiv.className = `message ${isSent ? 'sent' : 'received'}`;
    
    const time = new Date(message.sent_at).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
    });

    messageDiv.innerHTML = `
        <div class="message-bubble">
            <div class="message-text">${escapeHtml(message.message)}</div>
            <div class="message-time">${time}</div>
        </div>
    `;

    messagesContainer.appendChild(messageDiv);
    scrollToBottom();
}

function handleSendMessage(e) {
    e.preventDefault();
    
    const message = messageInput.value.trim();
    
    if (!message || !state.selectedUser) return;

    state.socket.emit('private-message', {
        senderId: state.currentUser.id,
        receiverId: state.selectedUser.id,
        message: message
    });

    messageInput.value = '';
    
    // Stop typing indicator
    if (state.typingTimeout) {
        clearTimeout(state.typingTimeout);
        state.typingTimeout = null;
    }
    state.socket.emit('typing', { receiverId: state.selectedUser.id, isTyping: false });
}

function handleTyping() {
    if (!state.selectedUser) return;

    // Send typing indicator
    state.socket.emit('typing', { receiverId: state.selectedUser.id, isTyping: true });

    // Clear previous timeout
    if (state.typingTimeout) {
        clearTimeout(state.typingTimeout);
    }

    // Set timeout to stop typing indicator
    state.typingTimeout = setTimeout(() => {
        state.socket.emit('typing', { receiverId: state.selectedUser.id, isTyping: false });
    }, 1000);
}

// Utility Functions
function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
