ALTER TABLE `submissions`
  ADD COLUMN `lease_token_hash` VARCHAR(64) NULL,
  ADD COLUMN `lease_session_id` VARCHAR(191) NULL,
  ADD COLUMN `lease_expires_at` DATETIME(3) NULL;
