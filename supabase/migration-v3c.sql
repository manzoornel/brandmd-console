-- Brand MD Console — v3 (Round 3A): payment method field. Safe on existing DB.
alter table payments add column if not exists method text default '';
