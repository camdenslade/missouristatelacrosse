CREATE TABLE apliq_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_ids TEXT NOT NULL DEFAULT ''
);
INSERT INTO apliq_config (product_ids) VALUES ('');
