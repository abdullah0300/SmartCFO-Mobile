create table public.expenses (
  id uuid not null default extensions.uuid_generate_v4 (),
  user_id uuid not null,
  amount numeric(10, 2) not null,
  category_id uuid null,
  description text not null,
  date date not null,
  vendor text null,
  receipt_url text null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  currency text null default 'USD'::text,
  exchange_rate numeric(10, 6) null default 1,
  base_amount numeric(10, 2) null,
  tax_rate numeric(5, 2) null default 0,
  tax_amount numeric(10, 2) null default 0,
  total_with_tax numeric GENERATED ALWAYS as ((amount + COALESCE(tax_amount, (0)::numeric))) STORED (10, 2) null,
  vendor_id uuid null,
  import_session_id uuid null,
  tax_metadata jsonb null default '{}'::jsonb,
  ec_acquisition boolean null default false,
  reverse_charge_applicable boolean null default false,
  base_tax_amount numeric(15, 2) null default 0,
  is_tax_deductible boolean null default true,
  tax_point_date date null,
  vat_return_id uuid null,
  vat_locked_at timestamp without time zone null,
  created_by uuid null,
  updated_by uuid null,
  deleted_at timestamp with time zone null,
  version integer null default 1,
  is_vat_reclaimable boolean null default true,
  reference_number text null,
  constraint expenses_pkey primary key (id),
  constraint expenses_category_id_fkey foreign KEY (category_id) references categories (id) on delete set null,
  constraint expenses_created_by_fkey foreign KEY (created_by) references auth.users (id),
  constraint expenses_vendor_id_fkey foreign KEY (vendor_id) references vendors (id) on delete set null,
  constraint expenses_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE,
  constraint expenses_vat_return_id_fkey foreign KEY (vat_return_id) references uk_vat_returns (id),
  constraint expenses_updated_by_fkey foreign KEY (updated_by) references auth.users (id),
  constraint expenses_amount_positive check ((amount > (0)::numeric)),
  constraint expenses_amount_check check ((amount > (0)::numeric))
) TABLESPACE pg_default;

create index IF not exists idx_expenses_user_date on public.expenses using btree (user_id, date desc) TABLESPACE pg_default;

create index IF not exists idx_expenses_vendor_id on public.expenses using btree (vendor_id) TABLESPACE pg_default;

create index IF not exists idx_expenses_import_session on public.expenses using btree (import_session_id) TABLESPACE pg_default
where
  (import_session_id is not null);

create index IF not exists idx_expenses_tax_metadata on public.expenses using gin (tax_metadata) TABLESPACE pg_default;

create index IF not exists idx_expenses_vat_return on public.expenses using btree (vat_return_id) TABLESPACE pg_default
where
  (vat_return_id is not null);

create index IF not exists idx_expenses_user_id on public.expenses using btree (user_id) TABLESPACE pg_default;

create index IF not exists idx_expenses_date on public.expenses using btree (date) TABLESPACE pg_default;

create index IF not exists idx_expenses_date_user on public.expenses using btree (user_id, date) TABLESPACE pg_default;

create index IF not exists idx_expenses_reference_number on public.expenses using btree (reference_number) TABLESPACE pg_default
where
  (reference_number is not null);

create index IF not exists idx_expenses_description on public.expenses using gin (to_tsvector('english'::regconfig, description)) TABLESPACE pg_default;

create trigger update_expenses_updated_at BEFORE
update on expenses for EACH row
execute FUNCTION update_updated_at_column ();

create trigger track_expenses_changes BEFORE INSERT
or
update on expenses for EACH row
execute FUNCTION track_user_changes ();

create trigger expense_summary_trigger
after INSERT
or DELETE
or
update on expenses for EACH row
execute FUNCTION update_summaries_on_transaction ();

create trigger expense_notification_trigger
after INSERT on expenses for EACH row
execute FUNCTION notify_expense_added ();

create trigger budget_check_trigger
after INSERT on expenses for EACH row
execute FUNCTION check_budget_exceeded ();