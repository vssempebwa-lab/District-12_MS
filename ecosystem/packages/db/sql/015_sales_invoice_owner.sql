-- Sales and invoices gain an owner, backfilled from the linked customer's owner.

alter table public.d12_ops_sales add column if not exists owner text not null default '';
alter table public.d12_ops_invoices add column if not exists owner text not null default '';

update public.d12_ops_sales s
set owner = c.owner
from public.d12_ops_customers c
where s.owner = ''
  and c.tenant_id = s.tenant_id
  and (
    c.id = s.customer_id
    or (
      not exists (
        select 1 from public.d12_ops_customers x
        where x.id = s.customer_id and x.tenant_id = s.tenant_id
      )
      and coalesce(s.customer_name, '') <> ''
      and c.name = s.customer_name
    )
  );

update public.d12_ops_invoices i
set owner = c.owner
from public.d12_ops_customers c
where i.owner = ''
  and c.tenant_id = i.tenant_id
  and (
    c.id = i.customer_id
    or (
      not exists (
        select 1 from public.d12_ops_customers x
        where x.id = i.customer_id and x.tenant_id = i.tenant_id
      )
      and coalesce(i.customer_name, '') <> ''
      and c.name = i.customer_name
    )
  );

notify pgrst, 'reload schema';
