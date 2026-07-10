-- Add granular tracking columns to proctoring_summary
ALTER TABLE proctoring_summary 
ADD COLUMN focus_loss_count INT DEFAULT 0,
ADD COLUMN clipboard_violation_count INT DEFAULT 0,
ADD COLUMN screenshot_violation_count INT DEFAULT 0,
ADD COLUMN print_violation_count INT DEFAULT 0;

ALTER TABLE browser_activity_logs
ADD COLUMN focus_loss_count INT DEFAULT 0,
ADD COLUMN clipboard_violation_count INT DEFAULT 0,
ADD COLUMN screenshot_violation_count INT DEFAULT 0,
ADD COLUMN print_violation_count INT DEFAULT 0;

ALTER TABLE browser_activity_summary
ADD COLUMN focus_loss_count INT DEFAULT 0,
ADD COLUMN clipboard_violation_count INT DEFAULT 0,
ADD COLUMN screenshot_violation_count INT DEFAULT 0,
ADD COLUMN print_violation_count INT DEFAULT 0;
