
-- Add user_name, user_role, and action_name columns to action_audit_log
ALTER TABLE public.action_audit_log
  ADD COLUMN IF NOT EXISTS user_name text,
  ADD COLUMN IF NOT EXISTS user_role text,
  ADD COLUMN IF NOT EXISTS action_name text;
