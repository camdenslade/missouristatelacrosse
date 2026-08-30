-- Normalize player defaults so JSON columns and balance are never null.
UPDATE men.players
SET balance = 0
WHERE balance IS NULL;

UPDATE women.players
SET balance = 0
WHERE balance IS NULL;

UPDATE men.players
SET parents = '[]'::jsonb
WHERE parents IS NULL OR parents = 'null'::jsonb;

UPDATE women.players
SET parents = '[]'::jsonb
WHERE parents IS NULL OR parents = 'null'::jsonb;

UPDATE men.players
SET data = '{}'::jsonb
WHERE data IS NULL OR data = 'null'::jsonb;

UPDATE women.players
SET data = '{}'::jsonb
WHERE data IS NULL OR data = 'null'::jsonb;
