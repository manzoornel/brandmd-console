-- Optional starter data. Run AFTER schema.sql if you want sample doctors.
insert into clients (name, type, package) values
  ('Dr. Manzoor (@DoctorUncle)', 'internal', 'In-house'),
  ('Dr. Jamsheer',               'internal', 'In-house'),
  ('Dr. Afsal',                  'external', 'Growth · 8 reels/mo')
on conflict do nothing;
