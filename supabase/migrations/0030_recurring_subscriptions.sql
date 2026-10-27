-- 0030_recurring_subscriptions.sql · Subscriptions tracking in recurring rules (2026-10-24)
--
-- Adds is_subscription flag to recurring_rules so households can keep track of
-- credit card subscriptions (Netflix, Spotify, Gym, iCloud, etc.) and avoid
-- unexpected charges on cards they forgot about.

alter table public.recurring_rules
  add column is_subscription boolean not null default false;
