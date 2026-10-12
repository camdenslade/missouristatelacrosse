-- Tappable sale items for the onsite Tap-to-Pay app (e.g. "Water $2", "Beer $5" for the
-- golf tournament), scoped to a specific event so each event has its own item list.
CREATE TABLE men.event_pos_items (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id    UUID NOT NULL REFERENCES men.events(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    price       NUMERIC(10,2) NOT NULL,
    sort_order  INT NOT NULL DEFAULT 0
);

CREATE TABLE women.event_pos_items (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id    UUID NOT NULL REFERENCES women.events(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    price       NUMERIC(10,2) NOT NULL,
    sort_order  INT NOT NULL DEFAULT 0
);

CREATE INDEX ON men.event_pos_items (event_id);
CREATE INDEX ON women.event_pos_items (event_id);
