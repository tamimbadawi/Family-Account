-- 0008_service_role_family_admin.sql · applied 2026-10-07
-- The family-admin Edge Function (service role, server-only) manages memberships.
-- 0001 revoked Supabase's default grants, so service_role had no SELECT/INSERT/UPDATE/DELETE
-- on household_members and every family-admin call answered "no_household".
grant select, insert, update, delete on table public.household_members to service_role;
