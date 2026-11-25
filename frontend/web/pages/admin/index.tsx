import { useCallback, useEffect, useState } from "react";
import Head from "next/head";
import { createPageRequest } from "@predrive/shared/api";
import { AdminShell } from "../../components/admin/AdminShell";
import { PageHeader } from "../../components/admin/PageHeader";
import { FeedbackState } from "../../components/ui/FeedbackState";
import { Button } from "../../components/ui/Button";
import { getWebApi } from "../../lib/api";

interface OverviewData {
  schoolName: string;
  children: number;
  buses: number;
  routes: number;
  alerts: number;
  incidents: number;
  invoices: number;
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <article className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
      <p className="text-sm font-semibold text-ink/70">{label}</p>
      <p className="mt-3 font-display text-3xl font-extrabold tabular-nums text-ink">
        {value.toLocaleString("en-ZW")}
      </p>
      <p className="mt-2 text-sm text-ink/60">{detail}</p>
    </article>
  );
}

export default function AdminOverview() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const api = getWebApi();
      const session = await api.auth.getSession();
      if (!session.ok || !session.data?.activeSchool) {
        setError("Your secure school session could not be verified. Sign in again.");
        return;
      }
      const membership = session.data.memberships.find(
        (item) =>
          item.schoolId === session.data?.activeSchool?.id &&
          item.active,
      );
      if (membership?.role !== "school_admin") {
        setError("This dashboard is available to school administrators only.");
        return;
      }
      const page = createPageRequest(1, 1);
      const [school, children, buses, routes, alerts, incidents, invoices] =
        await Promise.all([
          api.school.getCurrent(),
          api.children.list(page),
          api.transport.listBuses(page),
          api.transport.listRoutes(page),
          api.safety.listAlerts(page),
          api.safety.listIncidents(page),
          api.finance.listInvoices(page),
        ]);

      const failed = [
        school,
        children,
        buses,
        routes,
        alerts,
        incidents,
        invoices,
      ].find((result) => !result.ok);

      if (failed && !failed.ok) {
        setError(failed.error.message);
        return;
      }

      if (
        !school.ok ||
        !children.ok ||
        !buses.ok ||
        !routes.ok ||
        !alerts.ok ||
        !incidents.ok ||
        !invoices.ok
      ) {
        setError("Some school information could not be loaded. Refresh to try again.");
        return;
      }

      setData({
        schoolName: school.data.name,
        children: children.data.totalItems,
        buses: buses.data.totalItems,
        routes: routes.data.totalItems,
        alerts: alerts.data.totalItems,
        incidents: incidents.data.totalItems,
        invoices: invoices.data.totalItems,
      });
    } catch {
      setError("School information could not be loaded. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <Head>
        <title>School overview | preDrive</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <AdminShell schoolName={data?.schoolName}>
        <PageHeader
          title="School overview"
          description={
            data
              ? "Live operational totals for your school."
              : "Your school's transport and safety workspace."
          }
          actions={
            <Button variant="outline" onClick={() => void load()} loading={loading}>
              Refresh
            </Button>
          }
        />

        {loading && !data ? (
          <FeedbackState
            kind="loading"
            title="Loading school information"
            description="Securely retrieving your school's records."
          />
        ) : error && !data ? (
          <FeedbackState
            kind="error"
            title="School information is unavailable"
            description={error}
            onRetry={() => void load()}
          />
        ) : data ? (
          <>
            {error ? (
              <div
                role="status"
                className="mb-5 rounded-xl border border-warning bg-[#FFF8E8] p-4 text-sm text-ink"
              >
                {error}
              </div>
            ) : null}
            <section
              aria-label="School operational totals"
              className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
            >
              <MetricCard
                label="Children"
                value={data.children}
                detail="Enrolled child records"
              />
              <MetricCard
                label="Buses"
                value={data.buses}
                detail="Vehicles visible to your school role"
              />
              <MetricCard
                label="Routes"
                value={data.routes}
                detail="Configured transport routes"
              />
              <MetricCard
                label="Alerts"
                value={data.alerts}
                detail="School alert records"
              />
              <MetricCard
                label="Incidents"
                value={data.incidents}
                detail="Recorded safety incidents"
              />
              <MetricCard
                label="Invoices"
                value={data.invoices}
                detail="Issued school invoices"
              />
            </section>
            <p className="mt-6 text-xs text-ink/55">
              Totals are read from Supabase under your authenticated school permissions.
            </p>
          </>
        ) : null}
      </AdminShell>
    </>
  );
}
