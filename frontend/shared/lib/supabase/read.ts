import type { ApiResult, PageRequest, PageResult } from "../api/types";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "../api/pagination";
import { toSupabaseApiError, type SupabaseErrorLike } from "./errors";

export interface SupabaseReadResult<T> {
  data: T | null;
  error: SupabaseErrorLike | null;
  count?: number | null;
}

export interface SupabaseReadQuery<T> extends PromiseLike<SupabaseReadResult<T>> {
  order(
    column: string,
    options?: { ascending?: boolean; nullsFirst?: boolean },
  ): SupabaseReadQuery<T>;
  range(from: number, to: number): SupabaseReadQuery<T>;
  eq(column: string, value: string): SupabaseReadQuery<T>;
  maybeSingle<U = T>(): PromiseLike<SupabaseReadResult<U>>;
}

export interface SupabaseReadClient {
  from(table: string): {
    select(
      columns: string,
      options?: { count?: "exact" | "planned" | "estimated" },
    ): SupabaseReadQuery<unknown[]>;
  };
}

export interface ReadPageOptions {
  table: string;
  columns: string;
  orderBy: string;
  ascending?: boolean;
}

function validatePageRequest(request: PageRequest): string | null {
  if (
    !Number.isInteger(request.page) ||
    request.page < 1 ||
    !Number.isInteger(request.pageSize) ||
    request.pageSize < 1 ||
    request.pageSize > MAX_PAGE_SIZE
  ) {
    return "The requested page is invalid.";
  }

  return null;
}

/**
 * Execute an RLS-scoped, exact-count page query.
 *
 * The caller supplies only the table projection and deterministic ordering.
 * School identity is deliberately not accepted here: the authenticated JWT
 * and database RLS policies define which rows are visible.
 */
export async function selectPage<T>(
  client: SupabaseReadClient,
  options: ReadPageOptions,
  request: PageRequest,
): Promise<ApiResult<PageResult<T>>> {
  const invalidRequest = validatePageRequest(request);
  if (invalidRequest) {
    return {
      ok: false,
      error: {
        code: "VALIDATION",
        message: invalidRequest,
        retryable: false,
      },
    };
  }

  const from = (request.page - 1) * request.pageSize;
  const to = from + request.pageSize - 1;

  try {
    const { data, error, count } = await client
      .from(options.table)
      .select(options.columns, { count: "exact" })
      .order(options.orderBy, { ascending: options.ascending ?? true })
      .order("id", { ascending: true })
      .range(from, to);

    if (error) {
      return { ok: false, error: toSupabaseApiError(error) };
    }

    if (!Array.isArray(data) || typeof count !== "number" || !Number.isFinite(count)) {
      return {
        ok: false,
        error: {
          code: "UNAVAILABLE",
          message: "The records could not be loaded. Please try again.",
          retryable: true,
        },
      };
    }

    const items = data as T[];
    return {
      ok: true,
      data: {
        items,
        page: request.page,
        pageSize: request.pageSize,
        totalItems: count,
        hasNextPage: from + items.length < count,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: toSupabaseApiError(error),
    };
  }
}

/**
 * Execute a single-row lookup through the caller's authenticated Supabase
 * client. A null row is reported as NOT_FOUND, including when RLS correctly
 * hides a row from the current user.
 */
export async function selectOne<T>(
  client: SupabaseReadClient,
  table: string,
  columns: string,
  id: string,
): Promise<ApiResult<T>> {
  if (!id.trim()) {
    return {
      ok: false,
      error: {
        code: "VALIDATION",
        message: "A valid record ID is required.",
        retryable: false,
      },
    };
  }

  try {
    const query = client.from(table).select(columns) as SupabaseReadQuery<unknown[]>;
    const { data, error } = await query.eq("id", id).maybeSingle<Record<string, unknown>>();
    if (error) return { ok: false, error: toSupabaseApiError(error) };
    if (data === null) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "The requested record could not be found.",
          retryable: false,
        },
      };
    }

    return { ok: true, data: data as T };
  } catch (error) {
    return { ok: false, error: toSupabaseApiError(error) };
  }
}

export function defaultPageRequest(): PageRequest {
  return { page: 1, pageSize: DEFAULT_PAGE_SIZE };
}
