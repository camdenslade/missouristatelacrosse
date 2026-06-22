-- V21__custom_products.sql
-- Create custom_products table in men and women schemas

-- Men schema
CREATE TABLE IF NOT EXISTS men.custom_product (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    picture_url VARCHAR(500),
    description TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Women schema
CREATE TABLE IF NOT EXISTS women.custom_product (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    picture_url VARCHAR(500),
    description TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE
);