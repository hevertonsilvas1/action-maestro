
-- Add force_password_change flag to profiles
ALTER TABLE public.profiles ADD COLUMN force_password_change boolean NOT NULL DEFAULT false;
