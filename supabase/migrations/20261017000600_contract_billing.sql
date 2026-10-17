-- Tidyo · monthly contract billing: an invoice line can carry the contract and the month it bills
alter table public.invoice_lines
  add column if not exists contract_id uuid references public.contracts(id) on delete set null,
  add column if not exists billing_month date check (billing_month is null or extract(day from billing_month) = 1);
create index if not exists invoice_lines_contract_month on public.invoice_lines (contract_id, billing_month) where contract_id is not null;
