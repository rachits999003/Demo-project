# Database Configuration

## Environment Variables

You can configure the database connection using environment variables:

```bash
DB_HOST=localhost          # MySQL host
DB_USER=root               # MySQL username
DB_PASSWORD=               # MySQL password (empty by default)
DB_NAME=electron_chat      # Database name
```

## Default Configuration

The application uses these default values if environment variables are not set:
- Host: `localhost`
- User: `root`
- Password: `` (empty)
- Database: `electron_chat`

## Setting Up the Database

1. Install MySQL:
   - **Windows**: Download from https://dev.mysql.com/downloads/installer/
   - **macOS**: `brew install mysql`
   - **Linux**: `sudo apt-get install mysql-server`

2. Start MySQL service:
   - **Windows**: MySQL runs as a service automatically
   - **macOS**: `brew services start mysql`
   - **Linux**: `sudo systemctl start mysql`

3. Create the database:
   ```bash
   mysql -u root -p < database/schema.sql
   ```

4. Verify the setup:
   ```bash
   mysql -u root -p electron_chat -e "SHOW TABLES;"
   ```

   You should see:
   - `users`
   - `messages`

## Security Best Practices

1. **Change the default root password**:
   ```sql
   ALTER USER 'root'@'localhost' IDENTIFIED BY 'your_secure_password';
   ```

2. **Create a dedicated database user** (recommended for production):
   ```sql
   CREATE USER 'chatapp'@'localhost' IDENTIFIED BY 'secure_password';
   GRANT ALL PRIVILEGES ON electron_chat.* TO 'chatapp'@'localhost';
   FLUSH PRIVILEGES;
   ```

3. **Update the environment variables**:
   ```bash
   export DB_USER=chatapp
   export DB_PASSWORD=secure_password
   ```

## Troubleshooting

### Cannot connect to MySQL
- Verify MySQL is running: `systemctl status mysql` (Linux) or check Services (Windows)
- Check MySQL is listening on port 3306: `netstat -an | grep 3306`

### Access denied for user
- Verify credentials are correct
- Reset password if needed: https://dev.mysql.com/doc/refman/8.0/en/resetting-permissions.html

### Database does not exist
- Ensure you ran the schema.sql file
- Manually create: `CREATE DATABASE electron_chat;`
