-- Migration 0028: Investment units (gold in grams, stocks in shares)

alter table public.accounts
  add column unit text check (unit is null or unit in ('gram','share')),
  add column karat smallint check (karat is null or karat in (18,21,24)),
  add column opening_quantity numeric(14,4) check (opening_quantity is null or opening_quantity >= 0),
  add constraint accounts_unit_shape check (
    (unit is null and karat is null and opening_quantity is null)
    or (unit = 'gram'  and purpose = 'investment' and investment_kind = 'gold'   and karat is not null)
    or (unit = 'share' and purpose = 'investment' and investment_kind = 'stocks' and karat is null)
  );

alter table public.transactions
  add column quantity numeric(14,4)
    check (quantity is null or (quantity > 0 and type = 'transfer'));

alter table public.investment_values
  add column unit_price numeric(14,2) check (unit_price is null or unit_price >= 0);
