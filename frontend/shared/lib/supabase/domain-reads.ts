import type { ApiResult, PageRequest, PageResult } from "../api/types";
import type {
  Alert,
  Bus,
  Child,
  Incident,
  School,
  StaffMember,
} from "../../types";
import {
  mapAlert,
  mapBus,
  mapChild,
  mapIncident,
  mapSchool,
  mapStaffMember,
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
const INCIDENT_COLUMNS =
  "id,school_id,title,description,severity,status,trip_id,child_id,reported_by,occurred_at,created_at,updated_at";
const ALERT_COLUMNS =
  "id,school_id,title,message,severity,status,acknowledged_at,created_at,updated_at,alert_recipients(recipient_user_id)";

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
