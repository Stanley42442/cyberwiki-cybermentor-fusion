INSERT INTO public.profiles (id, mat_number, display_name, email, tier, status)
VALUES (
  '8b6891ec-6145-4347-8143-4fd1e6ba8004',
  'U2023/5571085',
  'U2023/5571085',
  'u20235571085@student.uniport.edu.ng',
  'admin',
  'verified'
)
ON CONFLICT (id) DO NOTHING;