-- Custom SQL migration file, put your code below! --

-- Backfill: users created before the eager-creation auth hook (imjoe-dev/plata#54) have no
-- user_preferences row. Give them one at 'USD' — the same value every existing Transaction/
-- Recurring Template row already carries via its own hardcoded schema default, per the
-- fallback plan in imjoe-dev/plata#52. Users that already have a row (created via the hook
-- going forward) are left untouched.
INSERT INTO user_preferences (user_id, default_currency)
SELECT id, 'USD' FROM users
WHERE id NOT IN (SELECT user_id FROM user_preferences);
