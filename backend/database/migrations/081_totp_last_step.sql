-- Last TOTP time-step used for login, so one code cannot be reused
-- across two pending tokens. NULL means no step has been claimed yet.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS totp_last_step BIGINT;
