-- stream_config was created in V16/V17 but never got an @Entity or any code reference;
-- per-game streaming config lives in the game.data JSONB column instead. Drop the dead
-- table (runs once per schema via spring.flyway.schemas=men,women).
DROP TABLE IF EXISTS stream_config CASCADE;
