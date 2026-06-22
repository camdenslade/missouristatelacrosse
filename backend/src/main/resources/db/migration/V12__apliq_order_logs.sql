CREATE TABLE apliq_order_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id VARCHAR(255),
    apliq_order_id INTEGER,
    timestamp BIGINT NOT NULL,
    request_payload TEXT,
    response_payload TEXT,
    http_status_code INTEGER,
    success BOOLEAN NOT NULL DEFAULT FALSE,
    error_message TEXT
);
