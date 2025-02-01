BEGIN;

-- Truncate (empty) all the tables you want. 
-- The CASCADE option will also remove dependent records in related tables.
-- RESTART IDENTITY resets the serial counters back to 1.
TRUNCATE TABLE named_entities, extractions, files, uploads, sessions, users 
RESTART IDENTITY CASCADE;

COMMIT;