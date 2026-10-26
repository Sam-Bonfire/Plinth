-- Order aggregate columns the read paths already query.
--
-- `POST /api/v1/orders`, shift close and the sales report all reference these
-- columns, but 0001_initial_schema never created them, so every order write
-- failed and EOD/report queries errored out.
ALTER TABLE orders ADD COLUMN charges_minor INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN grand_total_minor INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN balance_due_minor INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN payment_method TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN total_paid_minor INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN payload TEXT;
