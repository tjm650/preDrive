import type { PageRequest, PageResult } from "./types";
export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;
export function createPageRequest(page = 1, pageSize = DEFAULT_PAGE_SIZE): PageRequest {
  return { page: Math.max(1, Math.floor(page)), pageSize: Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(pageSize))) };
}
export function createEmptyPage<T>(request: PageRequest): PageResult<T> {
  return { items: [], page: request.page, pageSize: request.pageSize, totalItems: 0, hasNextPage: false };
}
export function appendPage<T>(current: PageResult<T>, next: PageResult<T>): PageResult<T> {
  if (next.page !== current.page + 1) throw new Error("Pages must be appended in sequence.");
  return { ...next, items: [...current.items, ...next.items] };
}
