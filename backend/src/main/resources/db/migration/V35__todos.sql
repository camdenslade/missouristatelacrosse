CREATE TABLE men.todos (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    season      TEXT        NOT NULL,
    title       TEXT        NOT NULL,
    description TEXT,
    link        TEXT,
    active      BOOLEAN     NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE women.todos (
    LIKE men.todos INCLUDING ALL
);

CREATE INDEX ON men.todos   (season);
CREATE INDEX ON women.todos (season);

CREATE TABLE men.todo_status (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    todo_id       UUID        NOT NULL,
    player_id     UUID        NOT NULL,
    done          BOOLEAN     NOT NULL DEFAULT false,
    done_at       TIMESTAMPTZ,
    marked_by_uid TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (todo_id, player_id)
);

CREATE TABLE women.todo_status (
    LIKE men.todo_status INCLUDING ALL
);

CREATE INDEX ON men.todo_status   (todo_id);
CREATE INDEX ON women.todo_status (todo_id);
CREATE INDEX ON men.todo_status   (player_id);
CREATE INDEX ON women.todo_status (player_id);
