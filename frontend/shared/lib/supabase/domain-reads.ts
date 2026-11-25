import type { ApiResult, PageRequest, PageResult } from "../api/types";
import type {
  Alert,
  Bus,
  Child,
  Incident,
  Invoice,
  School,
  StaffMember,
  TransportRoute,
  Trip,
} from "../../types";
import {
  mapAlert,
  mapBus,
  mapChild,
  mapIncident,
  mapInvoice,
  mapSchool,
  mapStaffMember,
  mapTrip,
  mapRoute,
  type DatabaseRow,
} from "./mappers";
import {
  selectOne,
  selectPage,
  type SupabaseReadClient,
} from "./read";

const SCHOOL_COLUMNS =
  "id,name,status,address,timezone,indicative_zig_per_usd,created_at,updated_at";
const CHILD_COLUMNS =
  "id,school_id,first_name,last_name,date_of_birth,class_group_id,status,profile_image_path,created_at,updated_at";
const STAFF_COLUMNS =
  "id,school_id,user_id,full_name,role,phone,active,created_at,updated_at";
const BUS_COLUMNS =
  "id,school_id,registration_number,make,model,capacity,status,created_at,updated_at";
const ROUTE_COLUMNS =
  "id,school_id,name,code,status,assigned_bus_id,created_at,updated_at,route_stops(id,name,address,stop_order,location,active)";
const INCIDENT_COLUMNS =
  "id,school_id,title,description,severity,status,trip_id,child_id,reported_by,occurred_at,created_at,updated_at";
const ALERT_COLUMNS =
  "id,school_id,title,message,severity,status,acknowledged_at,created_at,updated_at,alert_recipients(recipient_user_id)";
const INVOICE_COLUMNS =
  "id,school_id,child_id,guardian_user_id,invoice_number,currency,total_minor,balance_minor,status,due_date,created_at,updated_at,invoice_lines(id,description,line_total_minor)";
const TRIP_COLUMNS =
  "id,school_id,route_id,bus_id,supervisor_id,driver_id,direction,status,scheduled_at,started_at,ended_at,created_at,updated_at";

function rlsReadUnavailable<T>(domain: string): ApiResult<T> {
  return {
    ok: false,
    error: {
      code: "UNAVAILABLE",
      message: `The ${domain} read endpoint is not enabled for authenticated users yet. No records were changed. Please try again after the secure read policy is deployed.`,
      retryable: false,
    },
  };
}

function mapPage<T>(
  page: PageResult<DatabaseRow>,
  mapper: (row: DatabaseRow) => T,
): ApiResult<PageResult<T>> {
  try {
    return {
      ok: true,
      data: {
        ...page,
        items: page.items.map(mapper),
      },
    };
  } catch {
    return {
      ok: false,
      error: {
        code: "UNAVAILABLE",
        message: "Some records could not be loaded. Please try again.",
        retryable: true,
      },
    };
  }
}

function mapOne<T>(
  result: ApiResult<DatabaseRow>,
  mapper: (row: DatabaseRow) => T,
): ApiResult<T> {
  if (!result.ok) return result;
  try {
    return { ok: true, data: mapper(result.data) };
  } catch {
    return {
      ok: false,
      error: {
        code: "UNAVAILABLE",
        message: "The record could not be loaded. Please try again.",
        retryable: true,
      },
    };
  }
}

/**
 * Read-only domain adapter foundation.
 *
 * All requests use the injected, user-authenticated Supabase client. No
 * school_id filter is accepted from callers: tenant visibility is enforced
 * by the user's JWT and database RLS policies.
 *
 * Write operations and domain reads whose database-to-contract mapping is
 * not yet verified are intentionally not exposed here.
 */
export class SupabaseDomainReadAdapter {
  constructor(
    private readonly client: SupabaseReadClient,
    private readonly getActiveSchoolId: () => string | null,
  ) {}

  async getCurrentSchool(): Promise<ApiResult<School>> {
    const schoolId = this.getActiveSchoolId();
    if (!schoolId) {
      return {
        ok: false,
        error: {
          code: "UNAUTHENTICATED",
          message: "Sign in and select a school to continue.",
          retryable: false,
        },
      };
    }

    const result = await selectOne<DatabaseRow>(
      this.client,
      "schools",
      SCHOOL_COLUMNS,
      schoolId,
    );
    return mapOne(result, mapSchool);
  }

  async listChildren(
    request: PageRequest,
  ): Promise<ApiResult<PageResult<Child>>> {
    const result = await selectPage<DatabaseRow>(
      this.client,
      {
        table: "children",
        columns: CHILD_COLUMNS,
        orderBy: "last_name",
        ascending: true,
      },
      request,
    );
    return result.ok ? mapPage(result.data, mapChild) : result;
  }

  async getChild(childId: string): Promise<ApiResult<Child>> {
    const result = await selectOne<DatabaseRow>(
      this.client,
      "children",
      CHILD_COLUMNS,
      childId,
    );
    return mapOne(result, mapChild);
  }

  async listStaff(
    request: PageRequest,
  ): Promise<ApiResult<PageResult<StaffMember>>> {
    const result = await selectPage<DatabaseRow>(
      this.client,
      {
        table: "staff_members",
        columns: STAFF_COLUMNS,
        orderBy: "full_name",
        ascending: true,
      },
      request,
    );
    return result.ok ? mapPage(result.data, mapStaffMember) : result;
  }

  async listBuses(
    request: PageRequest,
  ): Promise<ApiResult<PageResult<Bus>>> {
    const result = await selectPage<DatabaseRow>(
      this.client,
      {
        table: "buses",
        columns: BUS_COLUMNS,
        orderBy: "registration_number",
        ascending: true,
      },
      request,
    );
    return result.ok ? mapPage(result.data, mapBus) : result;
  }

  async listRoutes(
    request: PageRequest,
  ): Promise<ApiResult<PageResult<TransportRoute>>> {
    const result = await selectPage<DatabaseRow>(
      this.client,
      {
        table: "transport_routes",
        columns: ROUTE_COLUMNS,
        orderBy: "name",
        ascending: true,
      },
      request,
    );
    return result.ok ? mapPage(result.data, mapRoute) : result;
  }

  async listIncidents(
    request: PageRequest,
  ): Promise<ApiResult<PageResult<Incident>>> {
    const result = await selectPage<DatabaseRow>(
      this.client,
      {
        table: "incidents",
        columns: INCIDENT_COLUMNS,
        orderBy: "occurred_at",
        ascending: false,
      },
      request,
    );
    return result.ok ? mapPage(result.data, mapIncident) : result;
  }

  async listTrips(
    request: PageRequest,
  ): Promise<ApiResult<PageResult<Trip>>> {
    const result = await selectPage<DatabaseRow>(
      this.client,
      {
        table: "trips",
        columns: TRIP_COLUMNS,
        orderBy: "scheduled_at",
        ascending: false,
      },
      request,
    );
    return result.ok ? mapPage(result.data, mapTrip) : result;
  }

  async listInvoices(
    request: PageRequest,
  ): Promise<ApiResult<PageResult<Invoice>>> {
    const result = await selectPage<DatabaseRow>(
      this.client,
      {
        table: "invoices",
        columns: INVOICE_COLUMNS,
        orderBy: "due_date",
        ascending: true,
      },
      request,
    );
    return result.ok ? mapPage(result.data, mapInvoice) : result;
  }

  async listAlerts(
    request: PageRequest,
  ): Promise<ApiResult<PageResult<Alert>>> {
    const result = await selectPage<DatabaseRow>(
      this.client,
      {
        table: "alerts",
        columns: ALERT_COLUMNS,
        orderBy: "created_at",
        ascending: false,
      },
      request,
    );
    return result.ok ? mapPage(result.data, mapAlert) : result;
  }
}
