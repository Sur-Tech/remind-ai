-- Add frequency field to routines table
ALTER TABLE public.routines 
ADD COLUMN frequency text NOT NULL DEFAULT 'once' CHECK (frequency IN ('once', 'daily', 'weekly', 'monthly'));