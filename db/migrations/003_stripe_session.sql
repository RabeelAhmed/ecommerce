-- Migration 003: Add stripe_session_id to orders table
-- and expand the status enum to include 'awaiting_payment' and 'paid'.

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS stripe_session_id TEXT UNIQUE;

-- Add new valid status values by updating the CHECK constraint.
-- PostgreSQL requires dropping and re-adding constraints.
ALTER TABLE orders
    DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE orders
    ADD CONSTRAINT orders_status_check
    CHECK (status IN ('awaiting_payment', 'pending', 'paid', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'));

CREATE INDEX IF NOT EXISTS idx_orders_stripe_session_id ON orders(stripe_session_id);
