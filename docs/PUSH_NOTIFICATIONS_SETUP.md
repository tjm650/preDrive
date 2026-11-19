# Push notifications: deployment setup

The application registers Expo push tokens, and the database creates recipient-specific notification rows. The `send-push` Edge Function sends each new row to Expo; the `check-push-receipts` worker checks delivery receipts every 15 minutes.

## Configure secrets after deploying the migrations

1. In Supabase **Edge Functions → Secrets**, set `NOTIFICATION_WEBHOOK_SECRET` to a new, randomly generated value. Set the same value in Vault in the next step. Do not commit it or paste it into source control.
2. In the Supabase SQL Editor, add the project URL and the same webhook secret to Vault:

   ```sql
   select vault.create_secret('https://rjsdhgbjvghjnuiilizm.supabase.co', 'project_url');
   select vault.create_secret('<the-same-random-value-as-NOTIFICATION_WEBHOOK_SECRET>', 'notification_webhook_secret');
   ```

3. Deploy the `send-push` and `check-push-receipts` Edge Functions.
4. Set `SITE_URL` for the invitation functions to the deployed web-app origin. Set `EXPO_ACCESS_TOKEN` if the Expo project uses authenticated push access.
5. Register a real device's Expo push token and insert a test notification for that user. Check the Edge Function logs, the private dispatch attempt record, and `push_receipts`.

The database trigger uses `pg_net` for asynchronous dispatch so notification inserts do not wait for Expo. It records missing Vault configuration and enqueue failures without blocking the notification transaction. Receipt polling is scheduled through `pg_cron`.

## Important limitations

- A queued pg_net request is asynchronous; a `queued` record means the HTTP request was enqueued, not that Expo delivered the notification.
- Expo receipts can report device unregistration. The worker clears invalid tokens.
- Push notifications are supplemental. Supervisors must follow the school's offline/emergency procedure when a device has no connection; never rely on push delivery as the only safety channel.
- Physical-device tests, background permission checks, and a full delivery/receipt test are still required before operational use.