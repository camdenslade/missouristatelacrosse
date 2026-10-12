-- Internal board calendar: meetings, deadlines, and other board-only entries. Compliance
-- filing due dates are merged in at read time from compliance_filings, not duplicated here.
CREATE TABLE men.board_calendar_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title       TEXT NOT NULL,
    event_date  DATE NOT NULL,
    notes       TEXT,
    created_by  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE women.board_calendar_events (
    LIKE men.board_calendar_events INCLUDING ALL
);
