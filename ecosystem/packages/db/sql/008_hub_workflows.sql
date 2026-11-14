-- Additive Hub-only migration. Apply manually after 001–007; no operational ERP tables are changed.
-- No employment, attendance, leave, payroll or training facts are seeded.
begin;

update public.d12_iam_roles
set permissions = array(select distinct p from unnest(permissions ||
  array['hr.manage','hr.payroll','hr.reports','team.manage','notifications.read']) p order by p)
where id = 'hr_admin';

create table if not exists public.d12_hub_records (
  id text primary key,
  kind text not null check (kind in ('employees','tasks','attendance','leave','payroll','performance',
    'vacancies','applications','training','enrolments','group_settings','hr_settings')),
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  version bigint not null default 1 check (version between 1 and 9007199254740991),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text not null references public.d12_iam_users(id) on delete restrict
);
create index if not exists d12_hub_kind_created on public.d12_hub_records(kind, created_at desc, id);
create unique index if not exists d12_hub_employee_account on public.d12_hub_records ((data->>'accountId'))
  where kind = 'employees' and coalesce(data->>'accountId','') <> '';
create unique index if not exists d12_hub_attendance_day on public.d12_hub_records ((data->>'employeeId'), (data->>'workOn')) where kind = 'attendance';
create unique index if not exists d12_hub_payroll_period on public.d12_hub_records ((data->>'employeeId'), (data->>'period')) where kind = 'payroll' and data->>'status' <> 'void';
create unique index if not exists d12_hub_review_period on public.d12_hub_records ((data->>'employeeId'), (data->>'period')) where kind = 'performance';
create unique index if not exists d12_hub_enrolment_session on public.d12_hub_records ((data->>'employeeId'), (data->>'trainingId')) where kind = 'enrolments';
create unique index if not exists d12_hub_settings_singleton on public.d12_hub_records(kind) where kind in ('group_settings','hr_settings');
create unique index if not exists d12_hub_hired_employee on public.d12_hub_records ((data->>'employeeId')) where kind = 'applications' and data->>'status' = 'hired';

create table if not exists public.d12_hub_notifications (
  id text primary key default ('hnt_' || replace(gen_random_uuid()::text,'-','')),
  recipient_id text not null references public.d12_iam_users(id) on delete cascade,
  title text not null check (length(title) between 1 and 180),
  href text not null check (href in ('/team','/tasks','/hr/attendance','/hr/leave','/hr/payroll',
    '/hr/performance','/hr/recruitment','/hr/training','/settings','/hr/settings')),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  archived_at timestamptz
);
create index if not exists d12_hub_notification_recipient on public.d12_hub_notifications(recipient_id, created_at desc, id);

-- Metadata is local to this migration: exact permissions, initial states, transitions and safe notification labels.
create or replace function public.d12_hub_meta(p_kind text)
returns jsonb language sql immutable set search_path = public as $$
  select case p_kind
    when 'employees' then '{"permission":"team.manage","initial":"active","label":"Employee profile","href":"/team","edges":["active:inactive","inactive:active"]}'::jsonb
    when 'tasks' then '{"permission":"group.tasks","initial":"open","label":"Task","href":"/tasks","edges":["open:in_progress","open:done","in_progress:done","done:open","cancelled:open","open:cancelled","in_progress:cancelled"]}'::jsonb
    when 'attendance' then '{"permission":"hr.manage","label":"Attendance record","href":"/hr/attendance"}'::jsonb
    when 'leave' then '{"permission":"hr.manage","initial":"requested","label":"Leave request","href":"/hr/leave","edges":["requested:approved","requested:rejected","requested:cancelled","approved:cancelled"],"terminal":["rejected","cancelled"]}'::jsonb
    when 'payroll' then '{"permission":"hr.payroll","initial":"draft","label":"Payroll entry","href":"/hr/payroll","edges":["draft:approved","approved:paid","draft:void","approved:void"],"terminal":["paid","void"]}'::jsonb
    when 'performance' then '{"permission":"hr.manage","initial":"draft","label":"Performance review","href":"/hr/performance","edges":["draft:submitted","submitted:finalized","submitted:draft"],"terminal":["finalized"]}'::jsonb
    when 'vacancies' then '{"permission":"hr.manage","initial":"open","label":"Vacancy","href":"/hr/recruitment","edges":["open:closed","closed:open"]}'::jsonb
    when 'applications' then '{"permission":"hr.manage","initial":"applied","label":"Application","href":"/hr/recruitment","edges":["applied:shortlisted","shortlisted:interview","interview:offered","offered:hired","applied:rejected","shortlisted:rejected","interview:rejected","offered:rejected"],"terminal":["hired","rejected"]}'::jsonb
    when 'training' then '{"permission":"hr.manage","initial":"scheduled","label":"Training session","href":"/hr/training","edges":["scheduled:completed","scheduled:cancelled"],"terminal":["completed","cancelled"]}'::jsonb
    when 'enrolments' then '{"permission":"hr.manage","initial":"enrolled","label":"Enrolment","href":"/hr/training","edges":["enrolled:attended","attended:completed","enrolled:withdrawn","attended:withdrawn"],"terminal":["completed","withdrawn"]}'::jsonb
    when 'group_settings' then '{"permission":"group.settings","label":"Group settings","href":"/settings"}'::jsonb
    when 'hr_settings' then '{"permission":"hr.manage","label":"HR settings","href":"/hr/settings"}'::jsonb
  end;
$$;

-- Only named global roles may access Hub records. Accountant permissions never imply personnel/payroll access.
create or replace function public.d12_hub_can(p_kind text, p_user text default null)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.d12_iam_users u
    join public.d12_iam_grants g on g.user_id = u.id and g.tenant_id is null
    join public.d12_iam_roles r on r.id = g.role_id and r.scope = 'global'
    where u.status = 'active' and (case when p_user is null then u.auth_id = auth.uid() else u.id = p_user end)
    and ((r.id = 'group_admin' and '*' = any(r.permissions))
      or (r.id = 'hr_admin' and p_kind not in ('tasks','group_settings') and
        ((p_kind = 'employees' and ('team.manage' = any(r.permissions) or 'hr.manage' = any(r.permissions)))
         or (p_kind <> 'employees' and public.d12_hub_meta(p_kind)->>'permission' = any(r.permissions)))))
  );
$$;

create or replace function public.d12_hub_date(p_value text)
returns date language plpgsql immutable set search_path = public as $$
declare v date;
begin
  if p_value is null or p_value !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception using errcode = '23514', message = 'Use a valid YYYY-MM-DD date';
  end if;
  v := p_value::date;
  if to_char(v,'YYYY-MM-DD') <> p_value then
    raise exception using errcode = '23514', message = 'Invalid calendar date';
  end if;
  return v;
exception when datetime_field_overflow or invalid_datetime_format then
  raise exception using errcode = '23514', message = 'Invalid calendar date';
end;
$$;

create or replace function public.d12_hub_account(p_id text, p_tenant text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if coalesce(p_id,'') = '' then return; end if;
  if not exists (select 1 from public.d12_iam_users where id = p_id and status = 'active') then
    raise exception using errcode = '23514', message = 'An active directory account is required';
  end if;
  if p_tenant <> 'group' and not exists (
    select 1 from public.d12_iam_grants g join public.d12_iam_roles r on r.id = g.role_id
    where g.user_id = p_id and (g.tenant_id = p_tenant or (g.tenant_id is null and r.scope = 'global'))
  ) then raise exception using errcode = '23514', message = 'Account subsidiary membership is required'; end if;
end;
$$;

create or replace function public.d12_hub_employment(p_kind text, p_data jsonb, p_employee jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_start date; v_end date; v_session jsonb;
begin
  if p_kind = 'attendance' then
    v_start := public.d12_hub_date(p_data->>'workOn'); v_end := v_start;
  elsif p_kind = 'leave' then
    v_start := public.d12_hub_date(p_data->>'startOn'); v_end := public.d12_hub_date(p_data->>'endOn');
  elsif p_kind in ('payroll','performance') then
    v_start := public.d12_hub_date((p_data->>'period') || '-01');
    v_end := (v_start + interval '1 month' - interval '1 day')::date;
    if v_end < public.d12_hub_date(p_employee->>'startOn') or
       (coalesce(p_employee->>'endOn','') <> '' and v_start > public.d12_hub_date(p_employee->>'endOn')) then
      raise exception using errcode = '23514', message = 'Period must overlap employment';
    end if;
    return;
  elsif p_kind = 'enrolments' then
    select data into v_session from public.d12_hub_records where kind = 'training' and id = p_data->>'trainingId';
    if v_session is null then raise exception using errcode = '23514', message = 'Training session not found'; end if;
    v_start := public.d12_hub_date(v_session->>'startsOn'); v_end := public.d12_hub_date(v_session->>'endsOn');
  else return;
  end if;
  if v_start < public.d12_hub_date(p_employee->>'startOn') or
     (coalesce(p_employee->>'endOn','') <> '' and v_end > public.d12_hub_date(p_employee->>'endOn')) then
    raise exception using errcode = '23514', message = 'Dates must fall within employment';
  end if;
end;
$$;

-- Both the RPC and direct table DML acquire this lock before inspecting related records.
-- Statement trigger also serializes multi-row service-role writes. Volatile trigger queries get fresh
-- READ COMMITTED snapshots after waiting; unique expression indexes are the final duplicate guard.
create or replace function public.d12_hub_lock()
returns trigger language plpgsql set search_path = public as $$
begin
  -- A pre-lock REPEATABLE READ snapshot could miss another employee's leave write.
  -- Service-role callers must use the default READ COMMITTED transaction isolation.
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception using errcode = '40001', message = 'Hub writes require READ COMMITTED isolation';
  end if;
  perform pg_advisory_xact_lock(1200812::bigint);
  return null;
end;
$$;
drop trigger if exists d12_hub_write_lock on public.d12_hub_records;
create trigger d12_hub_write_lock before insert or update or delete on public.d12_hub_records
  for each statement execute function public.d12_hub_lock();

create or replace function public.d12_hub_validate()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_meta jsonb; v_keys text[]; v_numbers text[] := '{}'; v_required text[] := '{}';
  v_key text; v_value jsonb; v_text text; v_limit integer; v_number numeric;
  v_employee jsonb; v_link jsonb; v_settings jsonb; v_record record;
  v_start date; v_end date; v_today date := (now() at time zone 'Africa/Kampala')::date;
  v_status text; v_old_status text; v_days integer; v_used integer;
  v_weekdays text[]; v_holidays text[]; v_actor text;
begin
  perform pg_advisory_xact_lock(1200812::bigint);
  if tg_op = 'DELETE' then
    v_meta := public.d12_hub_meta(old.kind);
    if old.kind in ('employees','attendance','group_settings','hr_settings') or
       coalesce(v_meta->'terminal','[]'::jsonb) ? (old.data->>'status') or
       (old.kind <> 'tasks' and old.data->>'status' in ('approved','submitted','offered','attended')) then
      raise exception using errcode = '40001', message = 'Profiles, approvals and historical records must be retained';
    end if;
    if exists (select 1 from public.d12_hub_records r where r.id <> old.id and
      ((old.kind = 'employees' and r.data->>'employeeId' = old.id) or
       (old.kind = 'vacancies' and r.data->>'vacancyId' = old.id) or
       (old.kind = 'training' and r.data->>'trainingId' = old.id))) then
      raise exception using errcode = '40001', message = 'Referenced workflow records must be retained';
    end if;
    -- Deletion is only exposed via version-checked RPC, not direct authenticated/service DML.
    if current_setting('d12.hub_delete_id',true) is distinct from old.id then
      raise exception using errcode = '40001', message = 'Delete through the version-checked Hub RPC';
    end if;
    return old;
  end if;
  v_meta := public.d12_hub_meta(new.kind);
  if v_meta is null or jsonb_typeof(new.data) is distinct from 'object' then
    raise exception using errcode = '23514', message = 'Unknown workflow kind or invalid payload';
  end if;
  v_status := new.data->>'status';
  if tg_op = 'UPDATE' then
    if new.id <> old.id or new.kind <> old.kind or new.created_by <> old.created_by or
       new.created_at <> old.created_at or new.version <> old.version + 1 then
      raise exception using errcode = '40001', message = 'Identity is immutable and version must advance by one';
    end if;
    v_old_status := old.data->>'status';
    if coalesce(v_meta->'terminal','[]'::jsonb) ? v_old_status then
      raise exception using errcode = '40001', message = 'Terminal workflow records are read-only';
    end if;
    if v_status is distinct from v_old_status and new.kind <> 'attendance' and
       not coalesce(v_meta->'edges','[]'::jsonb) ? (v_old_status || ':' || v_status) then
      raise exception using errcode = '23514', message = 'Workflow transition is not allowed';
    end if;
  elsif new.version <> 1 or (v_meta ? 'initial' and v_status is distinct from v_meta->>'initial') then
    raise exception using errcode = '23514', message = 'Create workflows in their initial state at version one';
  end if;

  -- Full, strict, normalized JSON payloads only (API Zod schemas supply defaults).
  case new.kind
    when 'employees' then
      v_keys := array['name','email','phone','accountId','tenantId','department','title','employmentType','status','startOn','endOn','annualLeaveDays','notes'];
      v_numbers := array['annualLeaveDays']; v_required := array['name','tenantId','startOn'];
    when 'tasks' then
      v_keys := array['title','tenantId','assigneeId','dueOn','priority','status','notes']; v_required := array['title','tenantId'];
    when 'attendance' then
      v_keys := array['employeeId','workOn','status','checkIn','checkOut','notes']; v_required := array['employeeId','workOn','status'];
    when 'leave' then
      v_keys := array['employeeId','type','startOn','endOn','status','workingDays','decisionReason','notes'];
      v_numbers := array['workingDays']; v_required := array['employeeId','type','startOn','endOn'];
    when 'payroll' then
      v_keys := array['employeeId','period','basic','allowances','deductions','gross','net','employeeName','tenantId','status','paymentReference','paidOn','notes'];
      v_numbers := array['basic','allowances','deductions','gross','net']; v_required := array['employeeId','period'];
    when 'performance' then
      v_keys := array['employeeId','reviewerId','period','objectives','rating','notes','status'];
      v_numbers := array['rating']; v_required := array['employeeId','reviewerId','period','objectives'];
    when 'vacancies' then
      v_keys := array['title','tenantId','department','openings','closesOn','status','notes'];
      v_numbers := array['openings']; v_required := array['title','tenantId'];
    when 'applications' then
      v_keys := array['name','email','vacancyId','interviewOn','employeeId','status','notes']; v_required := array['name','vacancyId'];
    when 'training' then
      v_keys := array['title','tenantId','startsOn','endsOn','trainer','status','notes']; v_required := array['title','tenantId','startsOn','endsOn'];
    when 'enrolments' then
      v_keys := array['employeeId','trainingId','status','notes']; v_required := array['employeeId','trainingId'];
    when 'group_settings' then
      v_keys := array['organizationName','contactEmail','contactPhone','reportingDays']; v_required := array['organizationName'];
    when 'hr_settings' then
      v_keys := array['departments','workingWeekdays','holidays','defaultAnnualLeaveDays'];
      v_numbers := array['defaultAnnualLeaveDays']; v_required := array['workingWeekdays'];
    else raise exception using errcode = '23514', message = 'Unsupported workflow';
  end case;
  if not new.data ?& v_keys or exists (select 1 from jsonb_object_keys(new.data) k where not k = any(v_keys)) then
    raise exception using errcode = '23514', message = 'Submit the full allowlisted payload';
  end if;
  for v_key, v_value in select key, value from jsonb_each(new.data) loop
    v_text := new.data->>v_key;
    if v_key = any(v_numbers) then
      if jsonb_typeof(v_value) is distinct from 'number' then raise exception using errcode = '23514', message = 'Numeric field required'; end if;
      v_number := v_text::numeric;
      if v_number <> trunc(v_number) or v_number < 0 or v_number > 1000000000000 then
        raise exception using errcode = '23514', message = 'Nonnegative bounded integer required';
      end if;
      if (v_key in ('annualLeaveDays','defaultAnnualLeaveDays','workingDays') and v_number > 366) or
         (v_key = 'rating' and v_number not between 1 and 5) or
         (v_key = 'openings' and v_number not between 1 and 1000) then
        raise exception using errcode = '23514', message = 'Numeric value out of range';
      end if;
    else
      if jsonb_typeof(v_value) is distinct from 'string' then raise exception using errcode = '23514', message = 'Text field required'; end if;
      if v_key = any(v_required) and btrim(v_text) = '' then raise exception using errcode = '23514', message = 'Required field is empty'; end if;
      v_limit := case
        when v_key in ('notes','objectives') then 2000 when v_key = 'decisionReason' then 500
        when v_key = 'departments' then 1000 when v_key = 'holidays' then 4000
        when v_key in ('phone','contactPhone') then 40 when v_key = 'department' then 80
        when v_key in ('employeeId','accountId','assigneeId','reviewerId','vacancyId','trainingId') then 100
        when v_key in ('email','contactEmail') then 320 else 120 end;
      if length(v_text) > v_limit then raise exception using errcode = '23514', message = 'Text value is too long'; end if;
      if v_key like '%On' and v_text <> '' then perform public.d12_hub_date(v_text); end if;
      if v_key in ('email','contactEmail') and v_text <> '' and v_text !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
        raise exception using errcode = '23514', message = 'Invalid email address';
      end if;
    end if;
  end loop;
  if new.data ? 'tenantId' and (new.data->>'tenantId' not in
    ('group','passito','mariz','rub-shoots','shop-for-me','expresso-point') or
    (new.data->>'tenantId' <> 'group' and not exists (
      select 1 from public.d12_tenants where id = new.data->>'tenantId'
    ))) then raise exception using errcode = '23514', message = 'Unknown subsidiary'; end if;
  if new.data ? 'period' and new.data->>'period' !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception using errcode = '23514', message = 'Use YYYY-MM period';
  end if;
  if new.data ? 'period' then perform public.d12_hub_date((new.data->>'period') || '-01'); end if;
  if (new.kind = 'attendance' and v_status not in ('present','late','absent')) or
     (new.kind = 'employees' and new.data->>'employmentType' not in ('permanent','contract','intern','other','unknown')) or
     (new.kind = 'tasks' and new.data->>'priority' not in ('low','normal','high')) or
     (new.kind = 'leave' and new.data->>'type' not in ('annual','sick','other')) or
     (new.kind = 'group_settings' and new.data->>'reportingDays' not in ('14','30','90')) then
    raise exception using errcode = '23514', message = 'Invalid workflow option';
  end if;
  -- Initial states and valid edges together allow only the finite configured status set.
  if v_meta ? 'initial' and v_status is distinct from v_meta->>'initial' and not exists (
    select 1 from jsonb_array_elements_text(v_meta->'edges') e where split_part(e,':',2) = v_status
  ) then raise exception using errcode = '23514', message = 'Invalid workflow status'; end if;

  if coalesce(new.data->>'employeeId','') <> '' then
    select data into v_employee from public.d12_hub_records where kind = 'employees' and id = new.data->>'employeeId';
    if v_employee is null then raise exception using errcode = '23514', message = 'Employee profile not found'; end if;
    if (tg_op = 'INSERT' or old.data->>'employeeId' is distinct from new.data->>'employeeId') and v_employee->>'status' <> 'active' then
      raise exception using errcode = '23514', message = 'An active employee is required for new references';
    end if;
    perform public.d12_hub_employment(new.kind,new.data,v_employee);
  end if;

  if new.kind = 'employees' then
    v_start := public.d12_hub_date(new.data->>'startOn');
    if new.data->>'endOn' <> '' and public.d12_hub_date(new.data->>'endOn') < v_start then
      raise exception using errcode = '23514', message = 'Employment dates are reversed';
    end if;
    perform public.d12_hub_account(new.data->>'accountId',new.data->>'tenantId');
    if tg_op = 'UPDATE' then
      for v_record in select * from public.d12_hub_records where data->>'employeeId' = new.id and id <> new.id loop
        perform public.d12_hub_employment(v_record.kind,v_record.data,new.data);
        if v_record.kind = 'enrolments' then
          select data into v_link from public.d12_hub_records where kind = 'training' and id = v_record.data->>'trainingId';
          if v_link->>'tenantId' <> 'group' and v_link->>'tenantId' <> new.data->>'tenantId' then
            raise exception using errcode = '23514', message = 'Existing enrolment subsidiary would be invalid';
          end if;
        elsif v_record.kind = 'applications' then
          select data into v_link from public.d12_hub_records where kind = 'vacancies' and id = v_record.data->>'vacancyId';
          if v_link->>'tenantId' <> new.data->>'tenantId' then raise exception using errcode = '23514', message = 'Existing hire subsidiary would be invalid'; end if;
        end if;
      end loop;
      if exists (select 1 from public.d12_hub_records where kind = 'leave' and data->>'employeeId' = new.id
        and data->>'type' = 'annual' and data->>'status' = 'approved'
        group by left(data->>'startOn',4) having sum((data->>'workingDays')::integer) > (new.data->>'annualLeaveDays')::integer) then
        raise exception using errcode = '40001', message = 'Entitlement cannot be below approved annual leave';
      end if;
    end if;
  elsif new.kind = 'tasks' then
    perform public.d12_hub_account(new.data->>'assigneeId',new.data->>'tenantId');
  elsif new.kind = 'attendance' then
    if public.d12_hub_date(new.data->>'workOn') > v_today then raise exception using errcode = '23514', message = 'Attendance date cannot be future'; end if;
    if (new.data->>'checkIn' <> '' and new.data->>'checkIn' !~ '^([01]\d|2[0-3]):[0-5]\d$') or
       (new.data->>'checkOut' <> '' and new.data->>'checkOut' !~ '^([01]\d|2[0-3]):[0-5]\d$') or
       (new.data->>'checkIn' <> '' and new.data->>'checkOut' <> '' and new.data->>'checkOut' < new.data->>'checkIn') or
       (v_status = 'absent' and (new.data->>'checkIn' <> '' or new.data->>'checkOut' <> '')) then
      raise exception using errcode = '23514', message = 'Invalid attendance times';
    end if;
    if tg_op = 'UPDATE' and btrim(new.data->>'notes') = '' then raise exception using errcode = '23514', message = 'Corrections require notes'; end if;
  elsif new.kind = 'leave' then
    v_start := public.d12_hub_date(new.data->>'startOn'); v_end := public.d12_hub_date(new.data->>'endOn');
    if v_start > v_end or v_end - v_start + 1 > 366 or extract(year from v_start) <> extract(year from v_end) then
      raise exception using errcode = '23514', message = 'Leave must fit an ordered interval within one calendar year';
    end if;
    if tg_op = 'UPDATE' and v_old_status = 'approved' then
      -- Freeze approval snapshots, including notes and workingDays, on cancellation.
      new.data := jsonb_set(new.data,'{workingDays}',old.data->'workingDays');
      if v_status <> 'cancelled' or (new.data - array['status','decisionReason']) <> (old.data - array['status','decisionReason']) then
        raise exception using errcode = '40001', message = 'Approved leave can only be cancelled with a reason';
      end if;
      v_days := (old.data->>'workingDays')::integer;
    else
      select data into v_settings from public.d12_hub_records where kind = 'hr_settings';
      v_weekdays := string_to_array(coalesce(v_settings->>'workingWeekdays','1,2,3,4,5'),',');
      v_holidays := string_to_array(coalesce(v_settings->>'holidays',''),',');
      select count(*) into v_days from generate_series(0,v_end-v_start) n
      where extract(dow from (v_start+n))::integer::text = any(v_weekdays)
        and not exists (select 1 from unnest(v_holidays) h where btrim(h) = to_char(v_start+n,'YYYY-MM-DD'));
      new.data := jsonb_set(new.data,'{workingDays}',to_jsonb(v_days));
    end if;
    if v_days < 1 then raise exception using errcode = '23514', message = 'Leave must contain a working day'; end if;
    if v_status in ('rejected','cancelled') and btrim(new.data->>'decisionReason') = '' then
      raise exception using errcode = '23514', message = 'Rejection or cancellation requires a reason';
    end if;
    if v_status in ('requested','approved') and exists (
      select 1 from public.d12_hub_records r where r.kind = 'leave' and r.id <> new.id
      and r.data->>'employeeId' = new.data->>'employeeId' and r.data->>'status' in ('requested','approved')
      and public.d12_hub_date(r.data->>'startOn') <= v_end and public.d12_hub_date(r.data->>'endOn') >= v_start
    ) then raise exception using errcode = '23505', message = 'Overlapping employee leave intervals'; end if;
    if v_status = 'approved' and new.data->>'type' = 'annual' then
      select coalesce(sum((r.data->>'workingDays')::integer),0) into v_used from public.d12_hub_records r
      where r.kind = 'leave' and r.id <> new.id and r.data->>'employeeId' = new.data->>'employeeId'
      and r.data->>'status' = 'approved' and r.data->>'type' = 'annual'
      and left(r.data->>'startOn',4) = left(new.data->>'startOn',4);
      if v_used + v_days > (v_employee->>'annualLeaveDays')::integer then
        raise exception using errcode = '23505', message = 'Annual leave approval exceeds entitlement';
      end if;
    end if;
  elsif new.kind = 'payroll' then
    if tg_op = 'UPDATE' and v_old_status = 'approved' then
      if (new.data - array['status','paymentReference','paidOn','notes']) <> (old.data - array['status','paymentReference','paidOn','notes']) then
        raise exception using errcode = '40001', message = 'Approved payroll amounts and snapshots are frozen';
      end if;
    else
      new.data := new.data || jsonb_build_object('gross',(new.data->>'basic')::bigint + (new.data->>'allowances')::bigint,
        'net',(new.data->>'basic')::bigint + (new.data->>'allowances')::bigint - (new.data->>'deductions')::bigint,
        'employeeName',v_employee->>'name','tenantId',v_employee->>'tenantId');
    end if;
    if (new.data->>'gross')::bigint not between 0 and 1000000000000 or
       (new.data->>'net')::bigint not between 0 and 1000000000000 then
      raise exception using errcode = '23514', message = 'Payroll totals must be nonnegative safe integers';
    end if;
    if (v_status = 'draft' or tg_op = 'INSERT' or v_old_status = 'draft') and
       (new.data->>'paymentReference' <> '' or new.data->>'paidOn' <> '') then
      raise exception using errcode = '23514', message = 'Draft payroll cannot claim payment';
    end if;
    if v_status = 'approved' and (new.data->>'gross')::bigint <= 0 then raise exception using errcode = '23514', message = 'Positive gross is required before approval'; end if;
    if v_status = 'paid' and (btrim(new.data->>'paymentReference') = '' or new.data->>'paidOn' = '' or public.d12_hub_date(new.data->>'paidOn') > v_today) then
      raise exception using errcode = '23514', message = 'Payment requires a reference and nonfuture date';
    end if;
  elsif new.kind = 'performance' then
    perform public.d12_hub_account(new.data->>'reviewerId',v_employee->>'tenantId');
  elsif new.kind = 'vacancies' then
    if tg_op = 'UPDATE' and exists (
      select 1 from public.d12_hub_records a join public.d12_hub_records e on e.kind = 'employees' and e.id = a.data->>'employeeId'
      where a.kind = 'applications' and a.data->>'vacancyId' = new.id and e.data->>'tenantId' <> new.data->>'tenantId'
    ) then raise exception using errcode = '23514', message = 'Vacancy subsidiary conflicts with linked employee'; end if;
  elsif new.kind = 'applications' then
    select data into v_link from public.d12_hub_records where kind = 'vacancies' and id = new.data->>'vacancyId';
    if v_link is null then raise exception using errcode = '23514', message = 'Vacancy not found'; end if;
    if (tg_op = 'INSERT' or old.data->>'vacancyId' is distinct from new.data->>'vacancyId') and
       (v_link->>'status' <> 'open' or (v_link->>'closesOn' <> '' and public.d12_hub_date(v_link->>'closesOn') < v_today)) then
      raise exception using errcode = '23514', message = 'New applicants require an open vacancy';
    end if;
    if v_status = 'interview' and new.data->>'interviewOn' = '' then raise exception using errcode = '23514', message = 'Interview date required'; end if;
    if v_employee is not null and v_employee->>'tenantId' <> v_link->>'tenantId' then raise exception using errcode = '23514', message = 'Employee must match vacancy subsidiary'; end if;
    if v_status = 'hired' and v_employee is null then raise exception using errcode = '23514', message = 'Link an existing employee before recording a hire'; end if;
  elsif new.kind = 'training' then
    v_start := public.d12_hub_date(new.data->>'startsOn'); v_end := public.d12_hub_date(new.data->>'endsOn');
    if v_start > v_end then raise exception using errcode = '23514', message = 'Training dates are reversed'; end if;
    if tg_op = 'UPDATE' then
      for v_record in select e.data from public.d12_hub_records n join public.d12_hub_records e on e.kind = 'employees' and e.id = n.data->>'employeeId'
        where n.kind = 'enrolments' and n.data->>'trainingId' = new.id loop
        if (new.data->>'tenantId' <> 'group' and new.data->>'tenantId' <> v_record.data->>'tenantId') or
           v_start < public.d12_hub_date(v_record.data->>'startOn') or
           (v_record.data->>'endOn' <> '' and v_end > public.d12_hub_date(v_record.data->>'endOn')) then
          raise exception using errcode = '23514', message = 'Training edit conflicts with existing enrolment';
        end if;
      end loop;
    end if;
  elsif new.kind = 'enrolments' then
    select data into v_link from public.d12_hub_records where kind = 'training' and id = new.data->>'trainingId';
    if v_link is null then raise exception using errcode = '23514', message = 'Training session not found'; end if;
    if v_link->>'tenantId' <> 'group' and v_link->>'tenantId' <> v_employee->>'tenantId' then raise exception using errcode = '23514', message = 'Employee must match training subsidiary'; end if;
    if (tg_op = 'INSERT' or old.data->>'trainingId' is distinct from new.data->>'trainingId') and v_link->>'status' <> 'scheduled' then
      raise exception using errcode = '23514', message = 'New enrolment requires scheduled training';
    end if;
    if v_link->>'status' = 'cancelled' and v_status in ('attended','completed') then raise exception using errcode = '23514', message = 'Cancelled training cannot record attendance/completion'; end if;
  elsif new.kind = 'hr_settings' then
    if new.data->>'workingWeekdays' !~ '^[0-6](,[0-6])*$' then raise exception using errcode = '23514', message = 'Invalid working weekday list'; end if;
    v_weekdays := string_to_array(new.data->>'workingWeekdays',',');
    if cardinality(v_weekdays) <> (select count(distinct d) from unnest(v_weekdays) d) then raise exception using errcode = '23514', message = 'Working weekdays must be unique'; end if;
    if btrim(new.data->>'holidays') <> '' then
      foreach v_text in array string_to_array(new.data->>'holidays',',') loop perform public.d12_hub_date(btrim(v_text)); end loop;
    end if;
  end if;
  new.updated_at := now();
  if tg_op = 'INSERT' then new.created_at := now(); end if;
  return new;
end;
$$;
drop trigger if exists d12_hub_records_validate on public.d12_hub_records;
create trigger d12_hub_records_validate before insert or update or delete on public.d12_hub_records
  for each row execute function public.d12_hub_validate();

-- Persist safe audit and per-recipient notifications in the same transaction as the record write.
-- Existing audit table is d12_iam_audit (not d12_iam_audit_log); no applicant names, salaries or notes are copied.
create or replace function public.d12_hub_effects()
returns trigger language plpgsql security definer set search_path = public as $$
declare v public.d12_hub_records; v_meta jsonb; v_action text; v_actor text; v_tenant text;
begin
  if tg_op = 'DELETE' then v := old; else v := new; end if;
  v_meta := public.d12_hub_meta(v.kind);
  v_action := case tg_op when 'INSERT' then 'created' when 'UPDATE' then 'updated' else 'deleted' end;
  v_actor := nullif(current_setting('d12.hub_actor',true),'');
  if v_actor is null then select id into v_actor from public.d12_iam_users where auth_id = auth.uid(); end if;
  v_tenant := nullif(v.data->>'tenantId','group');
  insert into public.d12_iam_audit(actor_id,action,target_user_id,tenant_id,detail)
  values(v_actor,'hub.' || v.kind || '.' || v_action,v.id,v_tenant,
    jsonb_build_object('message',v.kind || ' ' || v.id || ' v' || v.version,'recordId',v.id,'kind',v.kind,'version',v.version));
  insert into public.d12_hub_notifications(recipient_id,title,href)
  select u.id,(v_meta->>'label') || ' ' || v_action,v_meta->>'href'
  from public.d12_iam_users u where u.status = 'active' and (
    public.d12_hub_can(v.kind,u.id) or (v.kind = 'tasks' and u.id = v.data->>'assigneeId' and exists (
      select 1 from public.d12_iam_grants g join public.d12_iam_roles r on r.id = g.role_id
      where g.user_id = u.id and g.tenant_id is null and r.scope = 'global'
        and ('*' = any(r.permissions) or 'group.tasks' = any(r.permissions))
    ))
  );
  return coalesce(new,old);
end;
$$;
drop trigger if exists d12_hub_records_effects on public.d12_hub_records;
create trigger d12_hub_records_effects after insert or update or delete on public.d12_hub_records
  for each row execute function public.d12_hub_effects();

create or replace function public.d12_hub_write(
  p_operation text, p_kind text, p_id text, p_version bigint, p_data jsonb, p_actor text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v public.d12_hub_records;
begin
  perform pg_advisory_xact_lock(1200812::bigint);
  if not public.d12_hub_can(p_kind,p_actor) then
    raise exception using errcode = '23514', message = 'Actor does not have the exact Hub workflow permission';
  end if;
  if p_id is null or btrim(p_id) = '' or length(p_id) > 100 or p_operation is null or p_operation not in ('create','update','delete') then
    raise exception using errcode = '23514', message = 'Invalid write operation or identifier';
  end if;
  perform set_config('d12.hub_actor',p_actor,true);
  if p_operation = 'create' then
    if p_version is not null then raise exception using errcode = '23514', message = 'New records do not have an expected version'; end if;
    insert into public.d12_hub_records(id,kind,data,version,created_by) values(p_id,p_kind,p_data,1,p_actor) returning * into v;
  else
    if p_version is null or p_version < 1 then raise exception using errcode = '23514', message = 'Expected version required'; end if;
    select * into v from public.d12_hub_records where id = p_id and kind = p_kind for update;
    if not found then raise exception using errcode = 'P0002', message = 'Workflow record not found'; end if;
    if v.version <> p_version then raise exception using errcode = '40001', message = 'Workflow version conflict'; end if;
    if p_operation = 'update' then
      update public.d12_hub_records set data = p_data, version = version + 1 where id = p_id and kind = p_kind and version = p_version returning * into v;
    else
      perform set_config('d12.hub_delete_id',p_id,true);
      delete from public.d12_hub_records where id = p_id and kind = p_kind and version = p_version;
      perform set_config('d12.hub_delete_id','',true);
    end if;
  end if;
  perform set_config('d12.hub_actor','',true);
  return to_jsonb(v);
end;
$$;

alter table public.d12_hub_records enable row level security;
alter table public.d12_hub_notifications enable row level security;
drop policy if exists "d12 hub records read" on public.d12_hub_records;
create policy "d12 hub records read" on public.d12_hub_records for select to authenticated using (public.d12_hub_can(kind));
drop policy if exists "d12 hub records insert" on public.d12_hub_records;
create policy "d12 hub records insert" on public.d12_hub_records for insert to authenticated with check (
  public.d12_hub_can(kind) and created_by in (select id from public.d12_iam_users where auth_id = auth.uid() and status = 'active')
);
drop policy if exists "d12 hub records update" on public.d12_hub_records;
create policy "d12 hub records update" on public.d12_hub_records for update to authenticated using (public.d12_hub_can(kind)) with check (public.d12_hub_can(kind));
-- No direct DELETE policy: the API uses the service-only CAS RPC.
drop policy if exists "d12 hub notifications read" on public.d12_hub_notifications;
create policy "d12 hub notifications read" on public.d12_hub_notifications for select to authenticated using (
  recipient_id in (select id from public.d12_iam_users where auth_id = auth.uid() and status = 'active')
);
drop policy if exists "d12 hub notifications update" on public.d12_hub_notifications;
create policy "d12 hub notifications update" on public.d12_hub_notifications for update to authenticated using (
  recipient_id in (select id from public.d12_iam_users where auth_id = auth.uid() and status = 'active')
) with check (recipient_id in (select id from public.d12_iam_users where auth_id = auth.uid() and status = 'active'));

revoke all on public.d12_hub_records, public.d12_hub_notifications from public, anon, authenticated;
grant select, insert on public.d12_hub_records to authenticated;
grant update(data,version) on public.d12_hub_records to authenticated;
grant select on public.d12_hub_notifications to authenticated;
grant update(read_at,archived_at) on public.d12_hub_notifications to authenticated;
grant select, insert, update on public.d12_hub_records to service_role;
grant select, insert, update, delete on public.d12_hub_notifications to service_role;
revoke delete on public.d12_hub_records from service_role;
revoke all on function public.d12_hub_write(text,text,text,bigint,jsonb,text) from public,anon,authenticated;
grant execute on function public.d12_hub_write(text,text,text,bigint,jsonb,text) to service_role;
revoke all on function public.d12_hub_can(text,text), public.d12_hub_account(text,text), public.d12_hub_employment(text,jsonb,jsonb),
  public.d12_hub_lock(), public.d12_hub_validate(), public.d12_hub_effects() from public,anon,authenticated;
grant execute on function public.d12_hub_can(text,text) to authenticated,service_role;
revoke all on function public.d12_hub_meta(text), public.d12_hub_date(text) from public,anon;
grant execute on function public.d12_hub_meta(text), public.d12_hub_date(text) to authenticated,service_role;

notify pgrst, 'reload schema';
commit;
