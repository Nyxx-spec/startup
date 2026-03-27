-- ============================================================
--  FreshSave — Seed Demo Data
--  Run AFTER schema.sql
-- ============================================================

-- Demo Users (passwords are hashed by your Node.js backend before insert)
-- Plaintext shown here for reference only:
--   admin@freshsave.com  → admin123
--   maria@email.com      → pass123
--   etc.

insert into users (id, name, email, role, status, biz_type, location, permit, joined_at) values
  ('00000000-0000-0000-0000-000000000001', 'Admin',             'admin@freshsave.com',   'admin',  'Active',   null,           null,              null,           now() - interval '60 days'),
  ('00000000-0000-0000-0000-000000000002', 'Maria Santos',      'maria@email.com',       'buyer',  'Active',   null,           null,              null,           now() - interval '5 days'),
  ('00000000-0000-0000-0000-000000000003', 'Juan Dela Cruz',    'juan@email.com',        'buyer',  'Active',   null,           null,              null,           now() - interval '10 days'),
  ('00000000-0000-0000-0000-000000000004', 'Ana Reyes',         'ana@email.com',         'buyer',  'Active',   null,           null,              null,           now() - interval '15 days'),
  ('00000000-0000-0000-0000-000000000005', 'Sweet Crumb Bakery','sweetcrumb@email.com',  'seller', 'Verified', 'Bakery',      'Colon St, Cebu',  'BP-2024-001',  now() - interval '30 days'),
  ('00000000-0000-0000-0000-000000000006', 'Umami Kitchen',     'umami@email.com',       'seller', 'Pending',  'Restaurant',  'Osmeña Blvd',     'BP-2024-002',  now() - interval '7 days'),
  ('00000000-0000-0000-0000-000000000007', 'FreshMart Grocery', 'freshmart@email.com',   'seller', 'Pending',  'Supermarket', 'M. Velez St',     'BP-2024-003',  now() - interval '3 days'),
  ('00000000-0000-0000-0000-000000000008', 'Brew & Bean Café',  'brewbean@email.com',    'seller', 'Verified', 'Café',        'Capitol Site',    'BP-2024-004',  now() - interval '20 days')
on conflict (id) do nothing;

-- Demo Listings
insert into listings (item, business, type, orig_price, disc_price, location, pickup_time, posted_by, posted_email, status, featured) values
  ('Artisan Pastry Bundle',  'Sweet Crumb Bakery', 'Bakery',      200, 120, 'Colon St, Cebu',  '8:00 PM', 'Sweet Crumb Bakery', 'sweetcrumb@email.com', 'Approved', true),
  ('Bento Lunch Set ×2',     'Umami Kitchen',      'Restaurant',  300, 180, 'Osmeña Blvd',     '7:30 PM', 'Umami Kitchen',     'umami@email.com',      'Approved', false),
  ('Veggie Clearance Bag',   'FreshMart Grocery',  'Supermarket', 150,  95, 'M. Velez St',     '9:00 PM', 'FreshMart Grocery', 'freshmart@email.com',  'Approved', false),
  ('Café Pastry Box',        'Brew & Bean Café',   'Café',        140,  85, 'Capitol Site',    '7:00 PM', 'Brew & Bean Café',  'brewbean@email.com',   'Approved', true),
  ('Sourdough Loaves ×3',    'Sweet Crumb Bakery', 'Bakery',      240, 140, 'Colon St, Cebu',  '8:00 PM', 'Sweet Crumb Bakery', 'sweetcrumb@email.com', 'Approved', false),
  ('Mixed Sushi Platter',    'Umami Kitchen',      'Restaurant',  350, 200, 'Osmeña Blvd',     '8:30 PM', 'Umami Kitchen',     'umami@email.com',      'Pending',  false);

-- Demo Reservations
insert into reservations (id, buyer_name, buyer_email, item, business, price, status, pickup_status, created_at) values
  ('ORD-001', 'Maria Santos',   'maria@email.com', 'Artisan Pastry Bundle', 'Sweet Crumb Bakery', '₱120', 'Picked Up', 'Collected',       now() - interval '1 hour'),
  ('ORD-002', 'Juan Dela Cruz', 'juan@email.com',  'Bento Lunch Set ×2',   'Umami Kitchen',      '₱180', 'Reserved',  'Awaiting Pickup', now() - interval '2 hours'),
  ('ORD-003', 'Ana Reyes',      'ana@email.com',   'Veggie Clearance Bag', 'FreshMart Grocery',  '₱95',  'Disputed',  'Issue Raised',    now() - interval '1 day'),
  ('ORD-004', 'Maria Santos',   'maria@email.com', 'Café Pastry Box',      'Brew & Bean Café',   '₱85',  'Cancelled', 'Cancelled',       now() - interval '2 days')
on conflict (id) do nothing;

-- Demo Reports
insert into reports (id, reporter, reporter_email, against, issue_type, details, status) values
  ('RPT-001', 'Maria Santos',   'maria@email.com', 'FreshMart Grocery', 'Food Quality', 'Vegetables were wilted and not fresh as described. Paid ₱95 and got unusable produce.', 'Open'),
  ('RPT-002', 'Juan Dela Cruz', 'juan@email.com',  'Sweet Crumb Bakery','Wrong Item',   'Received croissants instead of sourdough as listed.', 'Warning Issued'),
  ('RPT-003', 'Ana Reyes',      'ana@email.com',   'Umami Kitchen',     'No Show',      'Went to pick up at indicated time but store was already closed.', 'Resolved')
on conflict (id) do nothing;

-- Demo Notifications
insert into notifications (msg, target, type) values
  ('New bakery deals near you this evening!',     'All Users',    'deal'),
  ('Weekend Flash Sale — check all fresh deals!', 'Buyers Only',  'promo'),
  ('Reminder: update your listing before 5 PM.',  'Sellers Only', 'reminder');

-- Demo Admin Log
insert into admin_log (msg, type) values
  ('Admin logged in',                                       'green'),
  ('Seller "Sweet Crumb Bakery" verified and approved',     'green'),
  ('Listing "Artisan Pastry Bundle" approved',              'blue'),
  ('Report RPT-002 resolved — warning issued to seller',    'amber'),
  ('Failed login attempt: unknown@spam.com',                'red');
