INSERT INTO winner_status_transitions (from_status_id, to_status_id)
VALUES 
  ('690d7119-1aa2-4fc1-b5b9-ceb3c1f00980', 'ff7cb670-6a4b-4355-8c1c-4799af0f83fe'),
  ('690d7119-1aa2-4fc1-b5b9-ceb3c1f00980', 'a2c8e18e-fd7e-4161-aebf-b455a1114db7'),
  ('690d7119-1aa2-4fc1-b5b9-ceb3c1f00980', '4c4972c0-695d-48bd-ace8-d42a9267660f')
ON CONFLICT DO NOTHING;