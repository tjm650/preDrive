# preDrive operations runbook

This runbook is an operational starting point for a school using preDrive. Each school must adapt it to its own safeguarding policy, transport arrangements, emergency contacts and local legal obligations.

## Before a school enables live trips

- Confirm the school administrator, supervisors and parent accounts belong to the correct school.
- Confirm every child is linked to the correct guardian and the guardian has provided the school's required consent.
- Verify authorised pickup people and PINs with the guardian using the school's identity-check procedure.
- Confirm each route's stops and road geometry have been physically checked. Only routes marked as manually verified can be scheduled.
- Confirm the assigned bus, driver, supervisor, passenger capacity and emergency contact procedure.
- Train supervisors to use the manifest, boarding, absence, arrival, handover, SOS and missing-child actions.
- Test the complete workflow on the actual Android devices and mobile network conditions used by the school.
- Confirm the school can contact guardians and emergency services without relying on the app.

## Daily trip procedure

### Before departure

1. The supervisor checks the vehicle and confirms the correct trip, route and manifest.
2. Reconcile the children physically present against the manifest before departure.
3. Record each child boarding or absent. Do not infer boarding from GPS or a parent's location.
4. Do not start a trip until the route, vehicle and assigned supervisor are correct.

### During the trip

- Keep the device charged and location permission enabled for the trip.
- Use the SOS action for an emergency and the child-missing action for a child who cannot be accounted for.
- If the device is offline, the app can queue routine trip events for later sync. SOS and missing-child alerts require connectivity; if they cannot be sent, use the school's phone/emergency procedure immediately.
- Do not treat a push notification as proof that a recipient has read or acted on it.

### Arrival and handover

- Record arrival at school only for pickup routes and home drop-off only for drop-off routes.
- Before releasing a child, select the authorised pickup person and complete the PIN verification.
- If the authorised person is not listed, the PIN fails, or the connection needed for verification is unavailable, do not release the child. Contact the school administrator and follow the school's documented escalation process.
- Complete the trip only after every manifest child has a final, reconciled status.

## Incident response

For SOS, a missing child, a failed handover, an unaccounted child or a vehicle incident:

1. Follow the school's safeguarding and emergency response plan first. Contact emergency services where appropriate; do not wait for an app notification.
2. Keep the child supervised and account for the rest of the manifest.
3. Notify the school lead and the relevant guardians through the approved channels.
4. Record the incident and actions taken as soon as it is safe to do so.
5. Preserve relevant trip events and audit records; do not delete or edit incident evidence.
6. Escalate suspected unauthorised access or exposure of child/location data to the platform owner and the school's privacy lead.

## Monitoring checks

The following SQL checks are useful for an administrator with database access:

```sql
-- Push dispatches that could not be queued
select * from private.push_dispatch_attempts
where status <> 'queued'
order by created_at desc;

-- HTTP requests rejected or failed by pg_net
select *
from net._http_response
where status_code >= 400 or error_msg is not null
order by created desc;

-- Push receipt outcomes
select status, count(*)
from public.push_receipts
group by status;

-- Confirm the receipt worker is scheduled
select jobid, jobname, schedule, active
from cron.job
where jobname = 'predrive-check-push-receipts';
```

A queued request only means pg_net accepted the request. Confirm Edge Function logs and Expo receipt status before treating push delivery as healthy. Alerting and an on-call rota still need to be configured for the deploying school/platform operator.

## Deployment, backup and recovery

- Run the local migration reset, pgTAP suite, generated-type check, web build and Android export before deployment.
- Inspect the target Supabase project's migration history and data before applying migrations. Use supabase db push; never use a remote database reset on a live project.
- Keep Supabase backups enabled according to the selected plan and the school's recovery objectives. Export critical configuration and maintain a separate, access-controlled backup where required.
- Perform a restore drill into an isolated project before live use and record the recovery time and data-loss window. A backup that has never been restored is not a verified recovery plan.
- Keep Edge Function secrets in Supabase Secrets and Vault, rotate them after suspected exposure, and never commit them to GitHub.
- After a deployment, verify login, role scoping, a complete test trip, push dispatch, receipt polling, route field-check gating and the recovery of queued offline events.

## Data and access hygiene

- Review school-admin and supervisor access regularly and revoke accounts promptly when staff leave.
- Keep child profiles, pickup authorisations, PINs, location data and incident details limited to the people who need them.
- Do not share screenshots, exports or logs containing children's personal information in public channels.
- Define retention and deletion periods with the school and obtain local privacy/legal review before live use.