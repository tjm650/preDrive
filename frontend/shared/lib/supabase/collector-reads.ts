import type { ApiResult } from "../api/types";
import type { ApprovedCollector, CollectorRelationship } from "../../types";
import type { SupabaseRpcClient } from "./trip-commands";
import { toSupabaseApiError } from "./errors";

type CollectorRow = Record<string, unknown>;

const RELATIONSHIPS: readonly CollectorRelationship[] = [
  "parent",
  "guardian",
  "relative",
  "authorised_caregiver",
  "other",
];

function requiredString(row: CollectorRow, key: string): string {
  const value = row[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error("Invalid collector record");
  }
  return value;
}

function mapCollector(row: CollectorRow): ApprovedCollector {
  const relationship = requiredString(row, "relationship");
  if (!RELATIONSHIPS.includes(relationship as CollectorRelationship)) {
    throw new Error("Invalid collector record");
  }
  if (typeof row.active !== "boolean") throw new Error("Invalid collector record");

  return {
    id: requiredString(row, "id"),
    schoolId: requiredString(row, "school_id"),
    childId: requiredString(row, "child_id"),
    fullName: requiredString(row, "full_name"),
    relationship: relationship as CollectorRelationship,
    phone: requiredString(row, "phone"),
    active: row.active,
    createdAt: requiredString(row, "created_at"),
    updatedAt: requiredString(row, "updated_at"),
  };
}

/**
 * Approved collector reads use the database RPC rather than selecting the
 * underlying table. The RPC enforces guardian, admin or active-supervisor
 * access and never returns PIN hashes or lockout counters.
 */
export class SupabaseCollectorReadAdapter {
  constructor(
    private readonly client: SupabaseRpcClient,
    private readonly getActiveSchoolId: () => string | null,
  ) {}

  async listApprovedCollectors(childId: string): Promise<ApiResult<ApprovedCollector[]>> {
    const schoolId = this.getActiveSchoolId();
    if (!schoolId) {
      return {
        ok: false,
        error: {
          code: "UNAUTHENTICATED",
          message: "Sign in and select a school to view approved collectors.",
          retryable: false,
        },
      };
    }
    if (!childId.trim()) {
      return {
        ok: false,
        error: {
          code: "VALIDATION",
          message: "A valid child is required.",
          retryable: false,
        },
      };
    }

    try {
      const { data, error } = await this.client.rpc<CollectorRow[]>(
        "list_approved_collectors",
        { p_school_id: schoolId, p_child_id: childId },
      );
      if (error) return { ok: false, error: toSupabaseApiError(error) };
      if (!Array.isArray(data)) {
        return {
          ok: false,
          error: {
            code: "UNAVAILABLE",
            message: "Approved collectors could not be loaded. Please try again.",
            retryable: true,
          },
        };
      }
      try {
        return { ok: true, data: data.map(mapCollector) };
      } catch {
        return {
          ok: false,
          error: {
            code: "UNAVAILABLE",
            message: "Approved collectors could not be loaded. Please try again.",
            retryable: true,
          },
        };
      }
    } catch (error) {
      return { ok: false, error: toSupabaseApiError(error) };
    }
  }
}
