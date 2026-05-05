export type Source = "offline" | "online";

export interface Option {
  id: string;
  name: string;
}

export interface MetaResponse {
  academicYears: string[];
  terms: string[];
  scheduleTypes: Option[];
  courseTypes: Option[];
  departments: Option[];
  onlineCourseTypes: Option[];
  dataVersion: string;
  defaultAcademicYear?: string;
  defaultTerm?: string;
}

export interface CourseItem {
  classNo: string;
  courseId: string;
  courseName: string;
  courseType: string;
  credits: number | null;
  remark: string;
  scheduleTime: string;
  scheduleWeek: string;
  teacher: string;
  url: string;
  academicYear: string;
  term: string;
  scheduleType: string;
  departmentId: string;
  departmentName: string;
}

export interface CourseSearchResponse {
  source: Source;
  items: CourseItem[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  dataVersion: string;
}

export interface Filters {
  source: Source;
  keyword: string;
  teacher: string;
  academic_year: string;
  term: string;
  schedule_type: string;
  course_type: string;
  department_id: string;
  page: number;
  page_size: number;
}
