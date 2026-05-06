-- Password update script for existing users
-- Run this in Supabase SQL Editor to update existing plain text passwords to hashed format
-- Using hash format: 'hash_<hex_hash>_<length>'

-- Patrick Dela Rosa (user_id: 1, SK_CHAIRMAN) - password: sk123
UPDATE users SET password = 'hash_7c78_5' WHERE user_id = 1;

-- Xyrus Jehan Lozanes (user_id: 2, LYDO) - password: lydo123
UPDATE users SET password = 'hash_fffff2b4_7' WHERE user_id = 2;

-- Harvey Daella (user_id: 4, PUBLIC_USER) - password: harvey123
UPDATE users SET password = 'hash_fffd5e3_8' WHERE user_id = 4;