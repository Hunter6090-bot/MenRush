-- Account deletion: rooms.created_by is ON DELETE SET NULL but was also
-- NOT NULL, so deleting any member who had ever created a room failed
-- (the FK tried to set NULL and the NOT NULL check refused it).
-- Allow NULL so the delete succeeds and the room stays for its other members.
ALTER TABLE rooms ALTER COLUMN created_by DROP NOT NULL;
