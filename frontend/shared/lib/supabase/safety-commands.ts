import type { ApiResult } from "../api/types";
import type { CreateIncidentInput } from "../api/inputs";
import type { Incident } from "../../types";
import type { SupabaseReadClient } from "./read";
import type { SupabaseRpcClient } from "./trip-commands";
import { selectOne } from "./read";
import { toSupabaseApiError } from "./errors";
import { mapIncident, type DatabaseRow } from "./mappers";

export interface SupabaseSafetyClient extends SupabaseRpcClient, SupabaseReadClient {}

function validation(message: string): ApiResult<never> {
  return {
    ok: false,
    error: { code: "VALIDATION", message, retryable: false },
  };
}

export class SupabaseSafetyCommandAdapter {
  constructor(
    private readonly client: SupabaseSafetyClient,
    private readonly getActiveSchoolId: () => string | null,
  ) {}

  async createIncident(input: CreateIncidentInput): Promise<ApiResult<Incident>> {
    const schoolId = this.getActiveSchoolId();
    if (!schoolId) return validation("Sign in and select a school before reporting an incident.");
    if (
      input.title.trim().length < 2 ||
      input.title.trim().length > 160 ||
      input.description.trim().length < 2 ||
      input.description.trim().length > 5000 ||
      !["low", "medium", "high", "critical"].includes(input.severity)
    ) {
      return validation("Check the incident title, description and severity.");
    }

    try {
      const { data: incidentId, error } = await this.client.rpc<string>("create_incident", {
        p_school_id: schoolId,
        p_title: input.title.trim(),
        p_description: input.description.trim(),
        p_severity: input.severity,
        p_trip_id: input.tripId ?? null,
        p_child_id: input.childId ?? null,
      });
      if (error) return { ok: false, error: toSupabaseApiError(error) };
      if (typeof incidentId !== "string" || !incidentId.trim()) {
        return {
          ok: false,
          error: {
            code: "UNAVAILABLE",
            message: "The incident was submitted but could not be confirmed. Refresh before retrying.",
            retryable: false,
          },
        };
      }

      const result = await selectOne<DatabaseRow>(
        this.client,
        "incidents",
        "id,school_id,title,description,severity,status,trip_id,child_id,reported_by,occurred_at,created_at,updated_at",
        incidentId,
      );
      if (!result.ok) return result;
      try {
        return { ok: true, data: mapIncident(result.data) };
      } catch {
        return {
          ok: false,
          error: {
            code: "UNAVAILABLE",
            message: "The incident was submitted but could not be loaded. Refresh before retrying.",
            retryable: false,
          },
        };
      }
    } catch (error) {
      return { ok: false, error: toSupabaseApiError(error) };
    }
  }
}
