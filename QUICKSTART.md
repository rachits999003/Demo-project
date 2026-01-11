# Quick Start Guide

This guide will help you set up and run the Desktop Chat Application quickly.

## Step 1: Install Prerequisites

1. **Install Node.js** (v14 or higher)
   - Download from: https://nodejs.org/
   - Verify installation: `node --version`

2. **Install MySQL** (v5.7 or higher)
   - Windows: https://dev.mysql.com/downloads/installer/
   - macOS: `brew install mysql`
   - Linux: `sudo apt-get install mysql-server`

## Step 2: Set Up Database

1. Start MySQL service:
   ```bash
   # Linux
   sudo service mysql start
   
   # macOS
   brew services start mysql
   
   # Windows - use Services app or MySQL Workbench
   ```

2. Create the database and tables:
   ```bash
   # Login to MySQL
   mysql -u root -p
   
   # Run the schema
   source schema.sql
   
   # Exit MySQL
   exit
   ```

## Step 3: Install Dependencies

```bash
cd Demo-project
npm install
```

This will install all required packages including:
- electron
- express
- socket.io
- mysql2
- bcrypt
- and more...

## Step 4: Configure Database (Optional)

If your MySQL has a password or uses different settings:

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` with your database credentials:
   ```
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_password_here
   DB_NAME=chat_app
   PORT=3000
   ```

## Step 5: Run the Application

Open two terminal windows:

**Terminal 1 - Start the backend server:**
```bash
npm run server
```

You should see:
```
✓ Database connected successfully
✓ Server running on port 3000
```

**Terminal 2 - Start the Electron app:**
```bash
npm start
```

The desktop application window should open!

## Step 6: Create an Account and Chat

1. Click "Register here" to create a new account
2. Fill in username, email, and password
3. Click "Register"
4. Login with your credentials
5. Register another account in a different window (repeat steps 1-4)
6. Select a user from the list and start chatting!

## Testing with Multiple Users

To test chat functionality between users:

1. Open the app and login as User A
2. Open another instance of the app (run `npm start` again) and login as User B
3. Now you can send messages between the two users in real-time!

## Building Executables

To create a standalone executable:

**Windows:**
```bash
npm run build
```

**All Platforms:**
```bash
npm run build:all
```

The executables will be in the `dist/` folder.

## Troubleshooting

### "Cannot connect to database"
- Make sure MySQL is running
- Check your database credentials in `.env`
- Verify the `chat_app` database exists

### "Port 3000 already in use"
- Another application is using port 3000
- Change the PORT in `.env` file
- Update `API_URL` in `renderer.js` accordingly

### "Module not found" errors
- Delete `node_modules` folder
- Delete `package-lock.json`
- Run `npm install` again

### Electron window doesn't open
- Check console for errors
- Try: `rm -rf node_modules && npm install`
- Restart your computer if issues persist

## Default Test Accounts

If you used the sample data in schema.sql:

- Username: `admin`, Password: `password123`
- Username: `testuser`, Password: `password123`

Note: The passwords in schema.sql are placeholders. For security, you should register new accounts through the app.

## Need Help?

- Check the full README.md for detailed documentation
- Review the code comments in each file
- Open an issue on GitHub if you encounter problems

Happy chatting! 💬
