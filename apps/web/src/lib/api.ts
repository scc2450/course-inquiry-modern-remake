import type { CourseSearchResponse, Filters, MetaResponse } from "../types";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

function buildParams(filters: Filters): URLSearchParams {
  const params = new URLSearchParams();
  params.set("source", filters.source);
  params.set("page", String(filters.page));
  params.set("page_size", String(filters.page_size));

  const optional: Array<[string, string]> = [
    ["keyword", filters.keyword],
    ["teacher", filters.teacher],
    ["academic_year", filters.academic_year],
    ["term", filters.term],
    ["schedule_type", filters.schedule_type],
    ["course_type", filters.course_type],
    ["department_id", filters.department_id],
  ];

  optional.forEach(([key, value]) => {
    if (value && value !== "all") {
      params.set(key, value);
    }
  });
  return params;
}

async function readJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail ?? `Request failed with ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function fetchMeta(): Promise<MetaResponse> {
  return readJson<MetaResponse>(`${API_BASE}/api/meta`);
}

export async function searchCourses(filters: Filters): Promise<CourseSearchResponse> {
  const params = buildParams(filters);
  return readJson<CourseSearchResponse>(`${API_BASE}/api/courses/search?${params.toString()}`);
}

export function exportUrl(filters: Filters): string {
  const params = buildParams({ ...filters, source: "offline", page: 1 });
  return `${API_BASE}/api/courses/export.csv?${params.toString()}`;
}
