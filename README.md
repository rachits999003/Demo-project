# Desktop Chat Application

A professional desktop chat application built with Electron, featuring real-time messaging, MySQL database integration, and a sleek dark-themed UI.

## Features

- 🔐 **User Authentication**: Secure login and registration with bcrypt password hashing
- 💬 **Real-time Chat**: Private messaging between users using Socket.io
- 👥 **User List**: View all registered users and their online/offline status
- 🎨 **Modern UI**: Professional dark-themed interface with smooth animations
- 🔔 **Typing Indicators**: See when other users are typing
- 📱 **Cross-platform**: Build for Windows, Linux, and macOS
- 🗄️ **MySQL Database**: Persistent storage for users and messages

## Prerequisites

Before running the application, ensure you have the following installed:

- [Node.js](https://nodejs.org/) (v14 or higher)
- [MySQL](https://www.mysql.com/) (v5.7 or higher)
- npm (comes with Node.js)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/rachits999003/Demo-project.git
cd Demo-project
```

2. Install dependencies:
```bash
npm install
```

3. Set up the MySQL database:
```bash
# Log into MySQL
mysql -u root -p

# Run the schema file
source schema.sql
```

4. Configure database connection (optional):

Create a `.env` file in the root directory if you need custom database settings:
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=chat_app
PORT=3000
```

## Usage

### Running the Application

1. Start the backend server:
```bash
npm run server
```

2. In a new terminal, start the Electron app:
```bash
npm start
```

### Building for Production

Build Windows executable:
```bash
npm run build
```

Build for all platforms:
```bash
npm run build:all
```

The executables will be created in the `dist/` directory.

## Project Structure

```
Demo-project/
├── .github/
│   └── workflows/
│       └── build.yml          # GitHub Actions workflow for building
├── main.js                    # Electron main process
├── index.html                 # Main UI structure
├── styles.css                 # UI styling (dark theme)
├── renderer.js                # Frontend logic and Socket.io client
├── server.js                  # Express + Socket.io backend
├── db.js                      # MySQL connection helper
├── schema.sql                 # Database schema
├── package.json               # Project dependencies and scripts
└── README.md                  # This file
```

## Architecture

### Frontend (Electron)
- **main.js**: Electron main process, creates the application window
- **index.html**: UI structure with login, registration, and chat screens
- **styles.css**: Modern dark-themed styling with animations
- **renderer.js**: Client-side logic, API calls, and Socket.io event handling

### Backend (Express + Socket.io)
- **server.js**: Express API endpoints and Socket.io real-time messaging
- **db.js**: MySQL connection pool and helper functions
- **schema.sql**: Database schema for users and messages

### Database Schema

**Users Table:**
- `id`: Auto-incrementing primary key
- `username`: Unique username
- `password`: Bcrypt hashed password
- `email`: Unique email address
- `created_at`: Account creation timestamp
- `last_seen`: Last activity timestamp
- `status`: Online/offline status

**Messages Table:**
- `id`: Auto-incrementing primary key
- `sender_id`: Foreign key to users table
- `receiver_id`: Foreign key to users table
- `message`: Message content
- `timestamp`: Message timestamp
- `is_read`: Read status

## API Endpoints

### Authentication
- `POST /api/register` - Register new user (Rate limited: 5 requests per 15 minutes)
- `POST /api/login` - Login user (Rate limited: 5 requests per 15 minutes)
- `POST /api/logout` - Logout user

### Users
- `GET /api/users` - Get all users (Rate limited: 100 requests per 15 minutes)

### Messages
- `GET /api/messages/:userId/:otherUserId` - Get chat history between two users (Rate limited: 100 requests per 15 minutes)

### Health Check
- `GET /health` - Server health check

## Socket.io Events

### Client → Server
- `user-join` - User connects and authenticates
- `private-message` - Send private message
- `typing` - User is typing
- `stop-typing` - User stopped typing

### Server → Client
- `user-status-change` - User online/offline status changed
- `private-message` - Receive private message
- `message-sent` - Message delivery confirmation
- `user-typing` - Other user is typing
- `user-stop-typing` - Other user stopped typing
- `message-error` - Message sending error

## Security Features

- ✅ **Password Security**: Bcrypt password hashing with salt rounds
- ✅ **SQL Injection Prevention**: Parameterized queries with mysql2
- ✅ **XSS Prevention**: HTML escaping in the frontend
- ✅ **CORS Configuration**: Configurable CORS policy (defaults to localhost)
- ✅ **Secure Socket.io**: Configured with credentials and restricted origins
- ✅ **Electron Security**: Context isolation enabled, Node integration disabled
- ✅ **Rate Limiting**: 
  - Authentication endpoints: 5 requests per 15 minutes per IP
  - API endpoints: 100 requests per 15 minutes per IP
- ✅ **GitHub Actions Security**: Explicit minimal permissions for workflows
- ✅ **Environment Variables**: Sensitive data stored in .env (not committed)

## CI/CD

The project includes GitHub Actions workflows that automatically build executables for Windows, Linux, and macOS on every push to the main branch.

Artifacts are available in the Actions tab of the GitHub repository.

## Development

### Debug Mode

To enable Electron DevTools, uncomment the line in `main.js`:
```javascript
mainWindow.webContents.openDevTools();
```

### Testing

Start the server and application in separate terminals to test locally:
```bash
# Terminal 1
npm run server

# Terminal 2
npm start
```

## Troubleshooting

### Database Connection Issues
- Ensure MySQL is running: `sudo service mysql start` (Linux) or check Services (Windows)
- Verify database credentials in `db.js` or `.env` file
- Check if the `chat_app` database exists

### Socket.io Connection Issues
- Ensure the backend server is running on port 3000
- Check if the port is not blocked by firewall
- Verify `API_URL` in `renderer.js` matches your server address

### Build Issues
- Clear node_modules and reinstall: `rm -rf node_modules package-lock.json && npm install`
- Ensure you have the latest version of electron-builder

## License

MIT

## Author

Rachit Srivastava

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.