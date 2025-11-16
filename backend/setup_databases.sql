-- ============================================
-- GenThrust Repair Order Tracker
-- Database Setup Script
-- ============================================
-- This script creates both PRODUCTION and DEVELOPMENT databases

-- ============================================
-- PRODUCTION DATABASE
-- ============================================
CREATE DATABASE IF NOT EXISTS `ro_tracker_prod`;
USE `ro_tracker_prod`;

-- AI Conversation Logs Table
CREATE TABLE IF NOT EXISTS `ai_conversation_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `conversation_id` VARCHAR(50) NOT NULL,
  `timestamp` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `user` VARCHAR(255) NOT NULL,
  `user_message` TEXT NOT NULL,
  `ai_response` TEXT,
  `success` BOOLEAN DEFAULT TRUE,
  `error` TEXT NULL,
  `model` VARCHAR(100) DEFAULT 'claude-sonnet-4',
  `duration_ms` INT NULL,
  `context_ro_count` INT NULL,
  INDEX `idx_user` (`user`),
  INDEX `idx_timestamp` (`timestamp`),
  INDEX `idx_conversation_id` (`conversation_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Copy existing inventory tables structure from genthrust_inventory
-- (These will be populated separately)

-- ============================================
-- DEVELOPMENT DATABASE
-- ============================================
CREATE DATABASE IF NOT EXISTS `ro_tracker_dev`;
USE `ro_tracker_dev`;

-- AI Conversation Logs Table (same structure)
CREATE TABLE IF NOT EXISTS `ai_conversation_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `conversation_id` VARCHAR(50) NOT NULL,
  `timestamp` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `user` VARCHAR(255) NOT NULL,
  `user_message` TEXT NOT NULL,
  `ai_response` TEXT,
  `success` BOOLEAN DEFAULT TRUE,
  `error` TEXT NULL,
  `model` VARCHAR(100) DEFAULT 'claude-sonnet-4',
  `duration_ms` INT NULL,
  `context_ro_count` INT NULL,
  INDEX `idx_user` (`user`),
  INDEX `idx_timestamp` (`timestamp`),
  INDEX `idx_conversation_id` (`conversation_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create test data for development
INSERT INTO `ai_conversation_logs`
  (`conversation_id`, `user`, `user_message`, `ai_response`, `success`, `model`, `duration_ms`, `context_ro_count`)
VALUES
  ('test-conv-1', 'developer@genthrust.net', 'Show me all active ROs', 'I found 42 active repair orders...', TRUE, 'claude-sonnet-4', 1250, 100),
  ('test-conv-1', 'developer@genthrust.net', 'What about overdue ones?', 'There are 8 overdue repair orders...', TRUE, 'claude-sonnet-4', 980, 100),
  ('test-conv-2', 'cmalagon@genthrust.net', 'Update RO38462 to PAID', 'Done. RO38462 has been updated to PAID status.', TRUE, 'claude-sonnet-4', 2100, 95);

-- ============================================
-- DATABASE MIGRATION FROM genthrust_inventory
-- ============================================
-- If you want to copy existing inventory data to production:
-- UNCOMMENT the following lines and run them:

-- INSERT INTO ro_tracker_prod.stock_room SELECT * FROM genthrust_inventory.stock_room;
-- INSERT INTO ro_tracker_prod.bins_inventory SELECT * FROM genthrust_inventory.bins_inventory;
-- INSERT INTO ro_tracker_prod.inventoryindex SELECT * FROM genthrust_inventory.inventoryindex;
-- INSERT INTO ro_tracker_prod.transactions SELECT * FROM genthrust_inventory.transactions;
-- (Add more tables as needed)

-- ============================================
-- VERIFICATION
-- ============================================
-- Check production database
USE ro_tracker_prod;
SHOW TABLES;
SELECT COUNT(*) as ai_logs_count FROM ai_conversation_logs;

-- Check development database
USE ro_tracker_dev;
SHOW TABLES;
SELECT COUNT(*) as ai_logs_count FROM ai_conversation_logs;

-- ============================================
-- GRANT PERMISSIONS (if needed)
-- ============================================
-- GRANT ALL PRIVILEGES ON ro_tracker_prod.* TO 'root'@'localhost';
-- GRANT ALL PRIVILEGES ON ro_tracker_dev.* TO 'root'@'localhost';
-- FLUSH PRIVILEGES;

SELECT 'Database setup complete! Use NODE_ENV to switch between prod and dev.' as message;
