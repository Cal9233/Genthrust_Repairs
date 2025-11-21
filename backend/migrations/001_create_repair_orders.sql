-- Migration: Create repair_orders table
-- Phase 3: Migrate primary data store from Excel to MySQL
-- Date: 2025-11-21

CREATE TABLE IF NOT EXISTS repair_orders (
  -- Primary Key (auto-generated)
  id INT AUTO_INCREMENT PRIMARY KEY,

  -- Identifiers
  roNumber VARCHAR(100) NOT NULL UNIQUE,

  -- Dates
  dateMade DATE,
  dateDroppedOff DATE,
  estimatedDeliveryDate DATE,
  currentStatusDate DATE,
  lastDateUpdated DATE,
  nextDateToUpdate DATE,

  -- Shop & Part Info
  shopName VARCHAR(255) NOT NULL,
  partNumber VARCHAR(100),
  serialNumber VARCHAR(100),
  partDescription TEXT NOT NULL,
  requiredWork TEXT,
  shopReferenceNumber VARCHAR(100),

  -- Costs
  estimatedCost DECIMAL(10, 2),
  finalCost DECIMAL(10, 2),
  terms VARCHAR(100),

  -- Status
  currentStatus VARCHAR(100) NOT NULL,
  genThrustStatus VARCHAR(100),
  shopStatus VARCHAR(100),
  trackingNumber VARCHAR(100),

  -- Notes & History
  notes TEXT,
  statusHistory JSON,

  -- Archive Status (Phase 2: Soft Archive)
  archiveStatus ENUM('ACTIVE', 'PAID', 'NET', 'RETURNED') NOT NULL DEFAULT 'ACTIVE',

  -- Timestamps
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- Indexes for performance
  INDEX idx_roNumber (roNumber),
  INDEX idx_shopName (shopName),
  INDEX idx_archiveStatus (archiveStatus),
  INDEX idx_currentStatus (currentStatus),
  INDEX idx_nextDateToUpdate (nextDateToUpdate)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add comments for documentation
ALTER TABLE repair_orders
  COMMENT = 'Repair Orders: Primary data store for aircraft part repairs (migrated from Excel in Phase 3)';
