-- Allow missed-call rows in the in-app notification feed
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (
  type IN (
    'message',
    'photo',
    'voice',
    'like',
    'match',
    'profile_view',
    'system',
    'missed_call'
  )
);
