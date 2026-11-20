export type ApiErrorCode = "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "VALIDATION" | "CONFLICT" | "RATE_LIMITED" | "NETWORK" | "UNAVAILABLE" | "UNKNOWN";
export interface ApiFieldError { field: string; message: string; }
export interface ApiError { code: ApiErrorCode; message: string; fieldErrors?: ApiFieldError[]; retryable: boolean; correlationId?: string; }
export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };
export interface PageRequest { page: number; pageSize: number; }
export interface PageResult<T> { items: T[]; page: number; pageSize: number; totalItems: number; hasNextPage: boolean; }
export interface SchoolScope { schoolId: string; }
export interface RequestState<T> { status: "idle" | "loading" | "success" | "error"; data?: T; error?: ApiError; }
