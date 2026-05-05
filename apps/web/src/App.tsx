import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  DatabaseIcon,
  DownloadIcon,
  ExternalLinkIcon,
  RefreshIcon,
  SearchIcon,
  WifiIcon,
} from "./components/icons";
import { exportUrl, fetchMeta, searchCourses } from "./lib/api";
import type { CourseItem, CourseSearchResponse, Filters, MetaResponse, Option, Source } from "./types";

const DEFAULT_FILTERS: Filters = {
  source: "offline",
  keyword: "",
  teacher: "",
  academic_year: "all",
  term: "all",
  schedule_type: "all",
  course_type: "all",
  department_id: "all",
  page: 1,
  page_size: 25,
};

const TERM_LABELS: Record<string, string> = {
  "1": "秋季",
  "2": "春季",
  "3": "暑校",
};

function optionLabel(option: Option): string {
  if (option.id === "all") return option.name;
  return option.name === option.id ? option.id : `${option.name} · ${option.id}`;
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {optionLabel(option)}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function StatusLine({
  response,
  loading,
  error,
}: {
  response: CourseSearchResponse | null;
  loading: boolean;
  error: string | null;
}) {
  if (loading) return <span className="status muted">查询中</span>;
  if (error) return <span className="status error">{error}</span>;
  if (!response) return <span className="status muted">等待查询</span>;
  return (
    <span className="status">
      共 {response.total} 条 · 第 {response.page} 页 · 数据 {response.dataVersion}
    </span>
  );
}

function CourseTable({ rows }: { rows: CourseItem[] }) {
  if (rows.length === 0) {
    return <div className="empty">没有符合条件的课程</div>;
  }

  return (
    <div className="tableWrap">
      <table>
        <thead>
          <tr>
            <th>课程</th>
            <th>类型</th>
            <th>学分</th>
            <th>教师</th>
            <th>时间</th>
            <th>周次</th>
            <th>院系</th>
            <th>详情</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((course, index) => (
            <tr key={`${course.courseId}-${course.classNo}-${index}`}>
              <td>
                <div className="courseName">{course.courseName}</div>
                <div className="courseId">{course.courseId || course.classNo}</div>
              </td>
              <td>{course.courseType || "-"}</td>
              <td>{course.credits ?? "-"}</td>
              <td>{course.teacher || "-"}</td>
              <td>{course.scheduleTime || "-"}</td>
              <td>{course.scheduleWeek || "-"}</td>
              <td>{course.departmentId || "-"}</td>
              <td>
                {course.url ? (
                  <a className="iconLink" href={course.url} target="_blank" rel="noreferrer" title="打开课程详情">
                    <ExternalLinkIcon size={17} />
                  </a>
                ) : (
                  "-"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function App() {
  const [meta, setMeta] = useState<MetaResponse | null>(null);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [response, setResponse] = useState<CourseSearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((current) => ({ ...current, [key]: value, page: key === "page" ? Number(value) : 1 }));
  };

  useEffect(() => {
    fetchMeta()
      .then((nextMeta) => {
        setMeta(nextMeta);
        setFilters((current) => ({
          ...current,
          academic_year: nextMeta.defaultAcademicYear ?? nextMeta.academicYears[0] ?? "all",
          term: nextMeta.defaultTerm ?? (nextMeta.terms.includes("2") ? "2" : nextMeta.terms[0] ?? "all"),
        }));
      })
      .catch((nextError: Error) => setError(nextError.message));
  }, []);

  async function runSearch(nextFilters = filters) {
    setLoading(true);
    setError(null);
    try {
      const result = await searchCourses(nextFilters);
      setResponse(result);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "查询失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (meta) {
      runSearch(filters);
    }
  }, [filters.page, filters.page_size, meta]);

  const yearOptions = useMemo<Option[]>(
    () => [{ id: "all", name: "全部" }, ...(meta?.academicYears ?? []).map((year) => ({ id: year, name: year }))],
    [meta],
  );

  const termOptions = useMemo<Option[]>(
    () => [
      { id: "all", name: "全部" },
      ...(meta?.terms ?? []).map((term) => ({ id: term, name: TERM_LABELS[term] ?? term })),
    ],
    [meta],
  );

  const courseTypeOptions = filters.source === "online" ? meta?.onlineCourseTypes : meta?.courseTypes;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextFilters = { ...filters, page: 1 };
    setFilters(nextFilters);
    runSearch(nextFilters);
  }

  function changeSource(source: Source) {
    setFilters((current) => ({
      ...current,
      source,
      page: 1,
      course_type: source === "online" ? "0" : "all",
      schedule_type: source === "online" ? "BKSKB" : current.schedule_type,
    }));
  }

  return (
    <main className="shell">
      <section className="topBar">
        <div>
          <p className="eyebrow">PKU Course Inquiry</p>
          <h1>课程查询</h1>
        </div>
        <div className="sourceSwitch" aria-label="数据源">
          <button
            type="button"
            className={filters.source === "offline" ? "active" : ""}
            onClick={() => changeSource("offline")}
          >
            <DatabaseIcon size={17} />
            离线
          </button>
          <button
            type="button"
            className={filters.source === "online" ? "active" : ""}
            onClick={() => changeSource("online")}
          >
            <WifiIcon size={17} />
            在线
          </button>
        </div>
      </section>

      <form className="filters" onSubmit={submit}>
        <TextField
          label="课程"
          value={filters.keyword}
          placeholder="课程名、课程号、关键词"
          onChange={(value) => update("keyword", value)}
        />
        <TextField
          label="教师"
          value={filters.teacher}
          placeholder="教师姓名"
          onChange={(value) => update("teacher", value)}
        />
        <SelectField
          label="学年"
          value={filters.academic_year}
          options={yearOptions}
          onChange={(value) => update("academic_year", value)}
        />
        <SelectField
          label="学期"
          value={filters.term}
          options={termOptions}
          onChange={(value) => update("term", value)}
        />
        <SelectField
          label="课表"
          value={filters.schedule_type}
          options={meta?.scheduleTypes ?? [{ id: "all", name: "全部" }]}
          onChange={(value) => update("schedule_type", value)}
        />
        <SelectField
          label="类型"
          value={filters.course_type}
          options={courseTypeOptions ?? [{ id: "all", name: "全部" }]}
          onChange={(value) => update("course_type", value)}
        />
        <SelectField
          label="院系"
          value={filters.department_id}
          options={meta?.departments ?? [{ id: "all", name: "全部" }]}
          onChange={(value) => update("department_id", value)}
        />
        <div className="actions">
          <button className="primary" type="submit" disabled={loading}>
            <SearchIcon size={18} />
            查询
          </button>
          <button type="button" onClick={() => runSearch()} disabled={loading}>
            <RefreshIcon size={18} />
            刷新
          </button>
          <a
            className={filters.source === "offline" ? "buttonLike" : "buttonLike disabled"}
            href={filters.source === "offline" ? exportUrl(filters) : undefined}
            aria-disabled={filters.source !== "offline"}
          >
            <DownloadIcon size={18} />
            CSV
          </a>
        </div>
      </form>

      <section className="resultHeader">
        <StatusLine response={response} loading={loading} error={error} />
        <label className="pageSize">
          <span>每页</span>
          <select value={filters.page_size} onChange={(event) => update("page_size", Number(event.target.value))}>
            {[10, 25, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      </section>

      <CourseTable rows={response?.items ?? []} />

      <section className="pager">
        <button type="button" disabled={filters.page <= 1 || loading} onClick={() => update("page", filters.page - 1)}>
          上一页
        </button>
        <span>第 {filters.page} 页</span>
        <button
          type="button"
          disabled={!response?.hasMore || loading}
          onClick={() => update("page", filters.page + 1)}
        >
          下一页
        </button>
      </section>
    </main>
  );
}
