-- Add reminder_time column to routines table
ALTER TABLE routines ADD COLUMN reminder_time TEXT DEFAULT '2_hours';

-- Add constraint to ensure valid reminder times
ALTER TABLE routines ADD CONSTRAINT valid_reminder_time CHECK (reminder_time IN ('2_hours', '1_day', 'none'));