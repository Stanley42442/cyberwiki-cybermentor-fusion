-- ============================================================
-- PROMOTE YOUR ACCOUNT TO ADMIN
-- Run this AFTER you've signed up at localhost:5173/signup
-- ============================================================

-- Step 1: Find your user ID (run this first, copy the id)
SELECT id, mat_number, display_name, tier, status
FROM public.profiles
ORDER BY created_at DESC
LIMIT 5;

-- Step 2: Replace YOUR_UUID below with the id from step 1, then run:
UPDATE public.profiles
SET tier = 'admin', status = 'verified'
WHERE mat_number = 'U2023/5571085';  -- ← change to YOUR mat number

-- Confirm it worked:
SELECT id, mat_number, tier, status FROM public.profiles WHERE tier = 'admin';
