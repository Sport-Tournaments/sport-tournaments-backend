-- Initialize database with required settings
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

-- Create default admin user (password: Admin@123 - bcrypt hashed)
-- Note: In production, create admin user through application or change password immediately
-- INSERT INTO users (id, email, password, first_name, last_name, role, is_active, is_verified, created_at, updated_at)
-- VALUES (
--   UUID(),
--   'admin@football-tournament.com',
--   '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/2cWqKOvWa',
--   'System',
--   'Admin',
--   'ADMIN',
--   1,
--   1,
--   NOW(),
--   NOW()
-- );

-- Grant additional permissions if needed
GRANT ALL PRIVILEGES ON football_tournament.* TO 'football_user'@'%';
FLUSH PRIVILEGES;
