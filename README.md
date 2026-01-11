# Electron Chat App

A secure, production-ready Electron chat application with real-time messaging capabilities.

## Features

- ✅ **Secure Authentication**: User registration and login with bcrypt password hashing
- ✅ **Real-time Messaging**: Instant private messaging using Socket.io
- ✅ **Professional UI**: Clean, dark mode interface with responsive design
- ✅ **User Management**: Browse online users and start conversations
- ✅ **Message History**: Persistent chat history stored in MySQL database
- ✅ **Session Management**: Secure session handling with Express
- ✅ **Modular Architecture**: Well-organized, maintainable codebase
- ✅ **Cross-platform**: Built with Electron for Windows, macOS, and Linux
- ✅ **CI/CD Ready**: GitHub Actions workflow for automated builds

## Prerequisites

Before running the application, ensure you have the following installed:

- **Node.js** (v16 or higher)
- **npm** (comes with Node.js)
- **MySQL** (v5.7 or higher)

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/rachits999003/Demo-project.git
cd Demo-project
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up MySQL Database

1. Start your MySQL server
2. Run the schema file to create the database and tables:

```bash
mysql -u root -p < database/schema.sql
```

Or import it manually:
- Open MySQL Workbench or command line
- Execute the contents of `database/schema.sql`

### 4. Configure Database Connection (Optional)

By default, the app connects to MySQL with:
- Host: `localhost`
- User: `root`
- Password: `` (empty)
- Database: `electron_chat`

To customize, set environment variables:

```bash
export DB_HOST=localhost
export DB_USER=root
export DB_PASSWORD=your_password
export DB_NAME=electron_chat
```

Or create a `.env` file in the root directory:

```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=electron_chat
```

## Usage

### Running the Application

**Option 1: Start everything together**

```bash
npm start
```

This will:
1. Start the Express/Socket.io server
2. Launch the Electron desktop application

**Option 2: Run server and client separately** (for development)

Terminal 1 - Start the server:
```bash
npm run server
```

Terminal 2 - Start the Electron app:
```bash
npm start
```

### First Time Setup

1. When the app launches, you'll see the login/register screen
2. Click "Register" to create a new account
3. Enter a username (min 3 characters) and password (min 6 characters)
4. After registration, log in with your credentials
5. You'll see a list of other users on the left
6. Click on any user to start chatting

## Building for Production

### Build for Windows

```bash
npm run dist
```

This creates a Windows installer (.exe) in the `dist/` folder.

### Build for All Platforms

```bash
npm run dist:all
```

This builds for Windows, macOS, and Linux.

## Project Structure

```
electron-chat-app/
├── .github/
│   └── workflows/
│       └── build-windows.yml    # GitHub Actions CI/CD
├── database/
│   └── schema.sql               # MySQL database schema
├── src/
│   ├── main.js                  # Electron main process
│   ├── preload.js               # Electron preload script
│   ├── server/
│   │   └── server.js            # Express + Socket.io server
│   └── renderer/
│       ├── index.html           # Main UI
│       ├── styles.css           # Styling (dark mode)
│       └── app.js               # Client-side logic
├── .gitignore
├── package.json
└── README.md
```

## Technology Stack

### Backend
- **Express.js**: Web server framework
- **Socket.io**: Real-time bidirectional communication
- **MySQL2**: MySQL database driver
- **bcrypt**: Password hashing
- **express-session**: Session management

### Frontend
- **Electron**: Cross-platform desktop application framework
- **Socket.io Client**: Real-time messaging
- **Vanilla JavaScript**: No framework dependencies
- **CSS3**: Modern, responsive styling

### DevOps
- **electron-builder**: Application packaging
- **GitHub Actions**: Automated builds and releases

## Security Features

- ✅ Passwords are hashed using bcrypt before storage
- ✅ SQL injection prevention with parameterized queries
- ✅ XSS protection with HTML escaping
- ✅ Session-based authentication
- ✅ Context isolation in Electron
- ✅ No direct Node.js access from renderer

## Development

### Code Organization

- **Modular Structure**: Separated concerns (server, renderer, database)
- **Clean Code**: Well-commented and formatted
- **Best Practices**: Following Electron and Node.js conventions

### Testing

To test the application:

1. Start the server: `npm run server`
2. Open multiple Electron instances to simulate different users
3. Register different accounts and test messaging

## Troubleshooting

### Database Connection Issues

If you see "Database connection failed":
1. Ensure MySQL is running: `mysql --version`
2. Verify database exists: `mysql -u root -p -e "SHOW DATABASES;"`
3. Check credentials in server.js or environment variables

### Port Already in Use

If port 3000 is in use:
1. Kill the process: `lsof -ti:3000 | xargs kill` (macOS/Linux)
2. Or change the PORT in `src/server/server.js`

### Build Errors

If `npm run dist` fails:
1. Ensure all dependencies are installed: `npm install`
2. Check Node.js version: `node --version` (should be v16+)
3. Clear cache: `npm cache clean --force`

## License

MIT

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit changes: `git commit -am 'Add feature'`
4. Push to branch: `git push origin feature-name`
5. Submit a pull request

## Support

For issues or questions:
- Open an issue on GitHub
- Check existing issues for solutions

---

**Note**: This is a production-ready application with all features implemented and tested. The code is modular, secure, and follows best practices for Electron and Node.js development.