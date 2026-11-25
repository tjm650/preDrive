import type { ApiResult } from "../api/types";
import type {
  ChildStatusInput,
  StartTripInput,
  VerifyHandoverInput,
} from "../api/inputs";
import type { Trip } from "../../types";
import type { DatabaseRow } from "./mappers";
import { mapTrip } from "./mappers";
import { toSupabaseApiError, type SupabaseErrorLike } from "./errors";

export interface SupabaseRpcResult<T> {
  data: T | null;
  error: SupabaseErrorLike | null;
}

export interface SupabaseRpcClient {
  rpc<T = unknown>(
    functionName: string,
    args: Record<string, unknown>,
  ): PromiseLike<SupabaseRpcResult<T>>;
}

function invalid(message: string): ApiResult<never> {
  return {
    ok: false,
    error: { code: "VALIDATION", message, retryable: false },
  };
}

function mapTripResult(row: unknown): ApiResult<Trip> {
  if (typeof row !== "object" || row === null || Array.isArray(row)) {
    return {
      ok: false,
      error: {
        code: "UNAVAILABLE",
        message: "The trip could not be loaded. Please try again.",
        retryable: true,
      },
    };
  }

  try {
    return { ok: true, data: mapTrip(row as DatabaseRow) };
  } catch {
    return {
      ok: false,
      error: {
        code: "UNAVAILABLE",
        message: "The trip could not be loaded. Please try again.",
        retryable: true,
      },
    };
  }
}

/**
 * Transactional operations backed by existing, schema-verified RPCs.
 * School scope comes from the active authenticated session and the RPC
 * re-checks membership/RLS. This adapter never accepts a school ID from UI.
 */
export class SupabaseTripCommandAdapter {
  constructor(
    private readonly client: SupabaseRpcClient,
    private readonly getActiveSchoolId: () => string | null,
  ) {}

  async startTrip(input: StartTripInput): Promise<ApiResult<Trip>> {
    const schoolId = this.getActiveSchoolId();
    if (!schoolId) return invalid("Sign in and select a school before starting a trip.");
    if (!input.tripId.trim() || !Number.isFinite(Date.parse(input.startedAt))) {
      return invalid("A valid trip and start time are required.");
    }

    try {
      const { data, error } = await this.client.rpc<DatabaseRow>("start_trip", {
        p_school_id: schoolId,
        p_trip_id: input.tripId,
        p_started_at: input.startedAt,
      });
      if (error) return { ok: false, error: toSupabaseApiError(error) };
      return mapTripResult(data);
    } catch (error) {
      return { ok: false, error: toSupabaseApiError(error) };
    }
  }

  async verifyHandover(input: VerifyHandoverInput): Promise<ApiResult<void>> {
    const schoolId = this.getActiveSchoolId();
    if (!schoolId) return invalid("Sign in and select a school before verifying handover.");
    if (
      !input.tripId.trim() ||
      !input.childId.trim() ||
      !input.collectorId.trim() ||
      !/^\d{4,8}$/.test(input.pin)
    ) {
      return invalid("A valid trip, child, approved collector and PIN are required.");
    }

    try {
      const { data, error } = await this.client.rpc<boolean>("verify_handover", {
        p_school_id: schoolId,
        p_trip_id: input.tripId,
        p_child_id: input.childId,
        p_collector_id: input.collectorId,
        p_pin: input.pin,
      });
      if (error) return { ok: false, error: toSupabaseApiError(error) };
      if (data !== true) {
        return {
          ok: false,
          error: {
            code: "FORBIDDEN",
            message: "The handover could not be verified. Check the collector and PIN.",
            retryable: false,
          },
        };
      }
      return { ok: true, data: undefined };
    } catch (error) {
      return { ok: false, error: toSupabaseApiError(error) };
    }
  }

  async recordChildStatus(_input: ChildStatusInput): Promise<ApiResult<void>> {
    return invalid(
      "Child status recording is unavailable until the API supplies the required boarding status.",
    );
  }

  async raiseSos(input: {
    tripId?: string;
    latitude?: number;
    longitude?: number;
  }): Promise<ApiResult<void>> {
    const schoolId = this.getActiveSchoolId();
    if (!schoolId) return invalid("Sign in and select a school before raising SOS.");
    if (!input.tripId?.trim()) return invalid("An active trip is required to raise trip SOS.");
    if (input.latitude !== undefined || input.longitude !== undefined) {
      return invalid(
        "Location-aware SOS is unavailable because the current database RPC does not accept coordinates.",
      );
    }

    try {
      const { error } = await this.client.rpc<string>("raise_sos", {
        p_school_id: schoolId,
        p_trip_id: input.tripId,
      });
      if (error) return { ok: false, error: toSupabaseApiError(error) };
      return { ok: true, data: undefined };
    } catch (error) {
      return { ok: false, error: toSupabaseApiError(error) };
    }
  }
}
