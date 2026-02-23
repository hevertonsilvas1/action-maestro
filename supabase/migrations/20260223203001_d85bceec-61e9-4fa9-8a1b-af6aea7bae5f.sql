-- Add 'archived' value to the action_status enum
ALTER TYPE public.action_status ADD VALUE IF NOT EXISTS 'archived';

-- Add column to store the previous status before archiving (for restore)
ALTER TABLE public.actions ADD COLUMN IF NOT EXISTS previous_status public.action_status;