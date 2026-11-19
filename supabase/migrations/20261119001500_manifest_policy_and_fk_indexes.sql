-- Consolidate supervisor/admin manifest writes into one predicate per action,
-- and cover every remaining unindexed foreign key reported by database advisors.

drop policy if exists route_children_admin_insert on public.route_children;
drop policy if exists route_children_supervisor_write on public.route_children;
create policy route_children_insert on public.route_children for insert to authenticated
with check (
  private.is_school_admin((select r.school_id from public.routes r where r.id = route_children.route_id))
  or (
    private.is_route_assigned(route_id)
    and exists (
      select 1 from public.children c
      where c.id = route_children.child_id
        and c.school_id = private.current_school_id()
    )
  )
);

drop policy if exists route_children_admin_update on public.route_children;
drop policy if exists route_children_supervisor_update on public.route_children;
create policy route_children_update on public.route_children for update to authenticated
using (
  private.is_school_admin((select r.school_id from public.routes r where r.id = route_children.route_id))
  or private.is_route_assigned(route_id)
)
with check (
  private.is_school_admin((select r.school_id from public.routes r where r.id = route_children.route_id))
  or (
    private.is_route_assigned(route_id)
    and exists (
      select 1 from public.children c
      where c.id = route_children.child_id
        and c.school_id = private.current_school_id()
    )
  )
);

create index if not exists school_join_codes_created_by_idx
  on private.school_join_codes(created_by);
create index if not exists stale_bus_location_state_school_id_idx
  on private.stale_bus_location_state(school_id);
create index if not exists audit_log_school_id_idx
  on public.audit_log(school_id);
create index if not exists incidents_child_id_idx
  on public.incidents(child_id);
create index if not exists incidents_school_id_idx
  on public.incidents(school_id);
create index if not exists invoices_school_id_idx
  on public.invoices(school_id);
create index if not exists push_receipts_notification_id_idx
  on public.push_receipts(notification_id);
create index if not exists push_receipts_user_id_idx
  on public.push_receipts(user_id);
create index if not exists route_children_stop_id_idx
  on public.route_children(stop_id);
