-- V22__custom_product_variants.sql
-- Add custom_product_variant table to men and women schemas

-- Men schema
CREATE TABLE IF NOT EXISTS men.custom_product_variant (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES men.custom_product(id) ON DELETE CASCADE,
    label VARCHAR(255) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    stock INT NOT NULL DEFAULT 0
);

-- Women schema
CREATE TABLE IF NOT EXISTS women.custom_product_variant (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES women.custom_product(id) ON DELETE CASCADE,
    label VARCHAR(255) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    stock INT NOT NULL DEFAULT 0
);
