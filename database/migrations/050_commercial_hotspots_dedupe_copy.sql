-- Drop duplicated Brand rules from curated commercial venue descriptions.
-- Sheet already shows the Brand helper once; description stays optional/factual only.

UPDATE hot_spots
   SET description = NULL
 WHERE source = 'commercial-curated'
   AND description ILIKE 'Commercial sauna%'
   AND is_user_generated = FALSE;
