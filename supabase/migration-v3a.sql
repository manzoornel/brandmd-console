-- Brand MD Console — v3 (Round 1)
-- Pipeline due dates + doctor package price. Safe to run on existing DB.
alter table videos  add column if not exists due_date date;
alter table clients add column if not exists price numeric not null default 0;
