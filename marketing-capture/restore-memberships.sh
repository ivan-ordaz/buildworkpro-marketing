#!/usr/bin/env bash
# Re-link the seeded demo users to their demo tenants in the LOCAL dev DB.
#
# Symptom this fixes: capture fails with "Logged in ... but no tenant was
# selected (memberships: 0)". Cause: some main-app tests clean up with
# unscoped deletes (e.g. server/lib/qbo/notify.test.ts `db.delete(tenantUsers)`),
# so running the main app's suite through Doppler empties tenant_users (plus
# notifications and activities) in whatever DB DATABASE_URL points at — the
# local dev DB. Until those tests are scoped, re-run this after it happens.
#
# Insert-only and idempotent: users are matched to tenants by email domain,
# roles by seed order (company_admin, manager, member, field_crew, viewer —
# server/seed/profiles/*.ts). Where several tenants share a name, the one with
# the most projects wins. Never touches any other DB.
set -euo pipefail

CONTAINER="${BWP_PG_CONTAINER:-bwp-postgres}"

docker exec -i "$CONTAINER" psql -U buildworkpro -d buildworkpro -v ON_ERROR_STOP=1 -q <<'SQL'
WITH demo(dom, tname) AS (VALUES
  ('comfortclimatehvac.com',      'Comfort Climate HVAC'),
  ('voltproelectric.com',         'Volt Pro Electric'),
  ('reliantplumbing.com',         'Reliant Plumbing'),
  ('solidgroundconcrete.com',     'Solid Ground Concrete'),
  ('summitcommercialroofing.com', 'Summit Commercial Roofing'),
  ('frameworkbuilders.com',       'Framework Builders'),
  ('clearlineglass.com',          'ClearLine Glass & Glazing')
),
tenant AS (
  SELECT d.dom, (
    SELECT t.id FROM tenants t WHERE t.name = d.tname
    ORDER BY (SELECT count(*) FROM projects p WHERE p.tenant_id = t.id) DESC, t.id
    LIMIT 1) AS tenant_id
  FROM demo d
),
ranked AS (
  SELECT u.id AS user_id, split_part(u.email, '@', 2) AS dom,
         row_number() OVER (PARTITION BY split_part(u.email, '@', 2) ORDER BY u.id) AS n
  FROM users u
  WHERE split_part(u.email, '@', 2) IN (SELECT dom FROM demo)
    AND u.username NOT LIKE '%\_test%'
)
INSERT INTO tenant_users (tenant_id, user_id, role, is_active, joined_at, created_at, updated_at)
SELECT t.tenant_id, r.user_id,
       (ARRAY['company_admin','manager','member','field_crew','viewer'])[r.n],
       true, now(), now(), now()
FROM ranked r JOIN tenant t USING (dom)
WHERE r.n <= 5 AND t.tenant_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM tenant_users tu WHERE tu.tenant_id = t.tenant_id AND tu.user_id = r.user_id);
SQL

docker exec "$CONTAINER" psql -U buildworkpro -d buildworkpro -At -F ' ' -c "
  SELECT t.name, count(*) FROM tenant_users tu JOIN tenants t ON t.id = tu.tenant_id
  WHERE t.name IN ('Comfort Climate HVAC','Volt Pro Electric','Reliant Plumbing','Solid Ground Concrete','Summit Commercial Roofing','Framework Builders','ClearLine Glass & Glazing')
  GROUP BY t.name ORDER BY t.name;"
