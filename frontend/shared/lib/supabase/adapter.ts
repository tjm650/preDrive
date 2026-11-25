import type { PreDriveApi } from "../api/contract";
import type { ApiResult, PageRequest, PageResult } from "../api/types";
import type {
  CreateBusInput,
  CreateChildInput,
  CreateIncidentInput,
  CreateTransportRouteInput,
  UpdateBusInput,
  UpdateSchoolSettingsInput,
  UpdateTransportRouteInput,
} from "../api/inputs";
import type { Child, School } from "../../types";
import type { SupabaseRuntime } from "./runtime";
import type { SupabaseReadClient } from "./read";
import type { SupabaseRpcClient } from "./trip-commands";
import type { SupabaseErrorLike } from "./errors";
import { toSupabaseApiError } from "./errors";
import { SupabaseDomainReadAdapter } from "./domain-reads";
import { SupabaseTripCommandAdapter } from "./trip-commands";
import { SupabaseCollectorReadAdapter } from "./collector-reads";
import { SupabaseSafetyCommandAdapter } from "./safety-commands";
import { SupabaseFinanceCommandAdapter } from "./finance-commands";
import { mapChild, mapSchool, type DatabaseRow } from "./mappers";
import { selectOne } from "./read";

interface MutationResult {
  data: DatabaseRow | null;
  error: SupabaseErrorLike | null;
}

interface MutationQuery extends PromiseLike<MutationResult> {
  eq(column: string, value: string): MutationQuery;
  select(columns: string): MutationQuery;
  maybeSingle(): PromiseLike<MutationResult>;
  update(values: Record<string, unknown>): MutationQuery;
}

export interface SupabaseMutationClient {
  from(table: string): MutationQuery;
}

function unavailable<T>(message: string): ApiResult<T> {
  return {
    ok: false,
    error: { code: "UNAVAILABLE", message, retryable: false },
  };
}

function validation<T>(message: string): ApiResult<T> {
  return {
    ok: false,
    error: { code: "VALIDATION", message, retryable: false },
  };
}

function mapRecord<T>(
  row: DatabaseRow | null,
  mapper: (value: DatabaseRow) => T,
  notFoundMessage: string,
): ApiResult<T> {
  if (!row) {
    return {
      ok: false,
      error: { code: "NOT_FOUND", message: notFoundMessage, retryable: false },
    };
  }
  try {
    return { ok: true, data: mapper(row) };
  } catch {
    return unavailable("The record could not be loaded. Please try again.");
  }
}

/**
 * The single API implementation supplied to both Expo and web applications.
 * All domain reads use the signed-in client and RLS. Sensitive transitions
 * use existing database RPCs. Operations without a verified database
 * transaction/policy fail closed instead of attempting unsafe table writes.
 */
export class SupabaseAdapter implements PreDriveApi {
  readonly auth: PreDriveApi["auth"];
  readonly school: PreDriveApi["school"];
  readonly children: PreDriveApi["children"];
  readonly staff: PreDriveApi["staff"];
  readonly transport: PreDriveApi["transport"];
  readonly safety: PreDriveApi["safety"];
  readonly finance: PreDriveApi["finance"];

  private readonly reads: SupabaseDomainReadAdapter;
  private readonly trips: SupabaseTripCommandAdapter;
  private readonly collectors: SupabaseCollectorReadAdapter;
  private readonly safetyCommands: SupabaseSafetyCommandAdapter;
  private readonly financeCommands: SupabaseFinanceCommandAdapter;
  private readonly getActiveSchoolId: () => string | null;

  constructor(input: {
    runtime: SupabaseRuntime;
    readClient: SupabaseReadClient;
    rpcClient: SupabaseRpcClient & SupabaseReadClient;
    mutationClient: SupabaseMutationClient;
  }) {
    const getActiveSchoolId = input.runtime.getActiveSchoolId;
    this.getActiveSchoolId = getActiveSchoolId;
    this.reads = new SupabaseDomainReadAdapter(input.readClient, getActiveSchoolId);
    this.trips = new SupabaseTripCommandAdapter(input.rpcClient, getActiveSchoolId);
    this.collectors = new SupabaseCollectorReadAdapter(input.rpcClient, getActiveSchoolId);
    this.safetyCommands = new SupabaseSafetyCommandAdapter(
      input.rpcClient,
      getActiveSchoolId,
    );
    this.financeCommands = new SupabaseFinanceCommandAdapter(
      input.rpcClient as SupabaseRpcClient & SupabaseReadClient,
      getActiveSchoolId,
    );

    this.auth = input.runtime.auth;
    this.school = {
      getCurrent: () => this.reads.getCurrentSchool(),
      update: (settings) => this.updateSchool(input.mutationClient, settings),
    };
    this.children = {
      list: (request) => this.reads.listChildren(request),
      get: (childId) => this.reads.getChild(childId),
      create: (data) => this.createChild(input.rpcClient, input.readClient, data),
      update: (childId, data) =>
        this.updateChild(input.mutationClient, input.readClient, childId, data),
    };
    this.staff = {
      list: (request) => this.reads.listStaff(request),
    };
    this.transport = {
      listBuses: (request) => this.reads.listBuses(request),
      createBus: (_data: CreateBusInput) =>
        unavailable("Bus creation requires the pending audited bus-management RPC."),
      updateBus: (_busId: string, _data: UpdateBusInput) =>
        unavailable("Bus updates require the pending audited bus-management RPC."),
      listRoutes: (request) => this.reads.listRoutes(request),
      createRoute: (_data: CreateTransportRouteInput) =>
        unavailable("Route creation requires the pending transactional route-and-stops RPC."),
      updateRoute: (_routeId: string, _data: UpdateTransportRouteInput) =>
        unavailable("Route updates require the pending transactional route-and-stops RPC."),
      listTrips: (request) => this.reads.listTrips(request),
      startTrip: (data) => this.trips.startTrip(data),
      recordChildStatus: (data) => this.trips.recordChildStatus(data),
      verifyHandover: (data) => this.trips.verifyHandover(data),
      listApprovedCollectors: (childId) => this.collectors.listApprovedCollectors(childId),
    };
    this.safety = {
      listAlerts: (request) => this.reads.listAlerts(request),
      listIncidents: (request) => this.reads.listIncidents(request),
      createIncident: (data: CreateIncidentInput) => this.safetyCommands.createIncident(data),
      raiseSos: (data) => this.trips.raiseSos(data),
    };
    this.finance = {
      listInvoices: (request) => this.reads.listInvoices(request),
      initiatePayment: (data) => this.financeCommands.initiatePayment(data),
      getReceipt: (paymentId) => this.financeCommands.getReceipt(paymentId),
    };
  }

  private async createChild(
    rpcClient: SupabaseRpcClient,
    readClient: SupabaseReadClient,
    input: CreateChildInput,
  ): Promise<ApiResult<Child>> {
    const schoolId = this.reads["getActiveSchoolId"];
    void schoolId;
    if (
      input.firstName.trim().length < 1 ||
      input.firstName.trim().length > 100 ||
      input.lastName.trim().length < 1 ||
      input.lastName.trim().length > 100 ||
      !Number.isFinite(Date.parse(input.dateOfBirth)) ||
      Date.parse(input.dateOfBirth) > Date.now() ||
      !input.classGroupId.trim()
    ) {
      return validation("Check the child's name, date of birth and class.");
    }
    const activeSchoolId = this.getActiveSchoolId();
    if (!activeSchoolId) return validation("Sign in and select a school before adding a child.");

    try {
      const { data, error } = await rpcClient.rpc<string>("create_child", {
        p_school_id: activeSchoolId,
        p_first_name: input.firstName.trim(),
        p_last_name: input.lastName.trim(),
        p_date_of_birth: input.dateOfBirth,
        p_class_group_id: input.classGroupId,
      });
      if (error) return { ok: false, error: toSupabaseApiError(error) };
      if (typeof data !== "string" || !data.trim()) {
        return unavailable("The child record could not be confirmed. Refresh before retrying.");
      }
      const result = await selectOne<DatabaseRow>(
        readClient,
        "children",
        "id,school_id,first_name,last_name,date_of_birth,class_group_id,status,profile_image_path,created_at,updated_at",
        data,
      );
      if (!result.ok) return result;
      return mapRecord(result.data, mapChild, "The child could not be found after creation.");
    } catch (error) {
      return { ok: false, error: toSupabaseApiError(error) };
    }
  }

  private async updateSchool(
    client: SupabaseMutationClient,
    input: UpdateSchoolSettingsInput,
  ): Promise<ApiResult<School>> {
    const schoolId = this.activeSchoolId();
    if (!schoolId) return validation("Sign in and select a school before updating school settings.");
    if (
      input.name.trim().length < 2 ||
      input.name.trim().length > 160 ||
      input.address.trim().length < 2 ||
      input.address.trim().length > 500 ||
      !Number.isFinite(input.indicativeZigPerUsd) ||
      input.indicativeZigPerUsd <= 0
    ) {
      return validation("Check the school name, address and indicative exchange rate.");
    }

    try {
      const { data, error } = await client
        .from("schools")
        .update({
          name: input.name.trim(),
          address: input.address.trim(),
          indicative_zig_per_usd: input.indicativeZigPerUsd,
        })
        .eq("id", schoolId)
        .select("id,name,status,address,timezone,indicative_zig_per_usd,created_at,updated_at")
        .maybeSingle();
      if (error) return { ok: false, error: toSupabaseApiError(error) };
      return mapRecord(data, mapSchool, "The school settings could not be found.");
    } catch (error) {
      return { ok: false, error: toSupabaseApiError(error) };
    }
  }

  private async updateChild(
    client: SupabaseMutationClient,
    readClient: SupabaseReadClient,
    childId: string,
    input: Partial<CreateChildInput>,
  ): Promise<ApiResult<Child>> {
    if (!childId.trim()) return validation("A valid child is required.");
    const values: Record<string, unknown> = {};
    if (input.firstName !== undefined) {
      if (input.firstName.trim().length < 1 || input.firstName.trim().length > 100) {
        return validation("The child's first name is invalid.");
      }
      values.first_name = input.firstName.trim();
    }
    if (input.lastName !== undefined) {
      if (input.lastName.trim().length < 1 || input.lastName.trim().length > 100) {
        return validation("The child's last name is invalid.");
      }
      values.last_name = input.lastName.trim();
    }
    if (input.dateOfBirth !== undefined) {
      if (!Number.isFinite(Date.parse(input.dateOfBirth)) || Date.parse(input.dateOfBirth) > Date.now()) {
        return validation("The child's date of birth is invalid.");
      }
      values.date_of_birth = input.dateOfBirth;
    }
    if (input.classGroupId !== undefined) {
      if (!input.classGroupId.trim()) return validation("A valid class is required.");
      values.class_group_id = input.classGroupId;
    }
    if (Object.keys(values).length === 0) {
      const { selectOne } = await import("./read");
      const result = await selectOne<DatabaseRow>(
        readClient,
        "children",
        "id,school_id,first_name,last_name,date_of_birth,class_group_id,status,profile_image_path,created_at,updated_at",
        childId,
      );
      if (!result.ok) return result;
      return mapRecord(result.data, mapChild, "The child could not be found.");
    }

    try {
      const { data, error } = await client
        .from("children")
        .update(values)
        .eq("id", childId)
        .select("id,school_id,first_name,last_name,date_of_birth,class_group_id,status,profile_image_path,created_at,updated_at")
        .maybeSingle();
      if (error) return { ok: false, error: toSupabaseApiError(error) };
      return mapRecord(data, mapChild, "The child could not be found or you do not have permission to update it.");
    } catch (error) {
      return { ok: false, error: toSupabaseApiError(error) };
    }
  }

}
