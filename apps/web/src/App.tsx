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
  source: "online",
  keyword: "",
  teacher: "",
  academic_year: "all",
  term: "all",
  schedule_type: "BKSKB",
  course_type: "0",
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
  if (option.id === "all" || option.name === "全部") return option.name;
  return option.name === option.id ? option.id : `${option.name} · ${option.id}`;
}

function parseAcademicYearStart(value: string): number {
  const start = Number(value.split("-", 1)[0]);
  if (Number.isNaN(start)) return -1;
  return start >= 80 ? 1900 + start : 2000 + start;
}

function formatAcademicYear(startYear: number): string {
  const start = String(startYear % 100).padStart(2, "0");
  const end = String((startYear + 1) % 100).padStart(2, "0");
  return `${start}-${end}`;
}

function normalizeYearInput(value: string, years: string[]): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  let startYear = Number(trimmed);
  if (!Number.isInteger(startYear)) return null;
  if (trimmed.length <= 2) {
    startYear = startYear >= 80 ? 1900 + startYear : 2000 + startYear;
  }
  const normalized = formatAcademicYear(startYear);
  return years.includes(normalized) ? normalized : null;
}

function yearStartInputValue(value: string): string {
  const startYear = parseAcademicYearStart(value);
  return startYear >= 0 ? String(startYear) : "";
}

function formatDataVersion(version: string): string {
  if (version === "live") return "实时数据";
  const numericVersion = Number(version);
  const date =
    /^\d+$/.test(version) && Number.isFinite(numericVersion)
      ? new Date(numericVersion * 1000)
      : new Date(version);
  if (!Number.isNaN(date.getTime())) {
    return `更新 ${date.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })}`;
  }
  return `版本 ${version}`;
}

function SelectField({
  label,
  value,
  options,
  onChange,
  formatOption = optionLabel,
}: {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  formatOption?: (option: Option) => string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {formatOption(option)}
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

function AcademicYearField({
  value,
  options,
  onChange,
}: {
  value: string;
  options: Option[];
  onChange: (value: string) => void;
}) {
  const years = options.map((option) => option.id).filter((id) => id !== "all");
  const [draftStartYear, setDraftStartYear] = useState(yearStartInputValue(value));
  const selectedLabel = value === "all" ? "全部学年" : value;
  const inputId = "academic-year-starts";

  useEffect(() => {
    setDraftStartYear(yearStartInputValue(value));
  }, [value]);

  const commitDraft = () => {
    const nextYear = normalizeYearInput(draftStartYear, years);
    if (nextYear) {
      onChange(nextYear);
      return;
    }
    setDraftStartYear(yearStartInputValue(value));
  };

  return (
    <div className="field yearField">
      <span>学年</span>
      <div className="yearPicker">
        <button
          type="button"
          className={value === "all" ? "yearAll active" : "yearAll"}
          onClick={() => {
            onChange("all");
          }}
        >
          全部
        </button>
        <input
          aria-label="学年起始年份"
          className="yearStartInput"
          inputMode="numeric"
          list={inputId}
          placeholder="2024"
          value={draftStartYear}
          onBlur={commitDraft}
          onChange={(event) => setDraftStartYear(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitDraft();
            }
          }}
        />
        <strong className="yearPreview">{selectedLabel}</strong>
        <datalist id={inputId}>
          {years.map((year) => (
            <option key={year} value={parseAcademicYearStart(year)}>
              {year}
            </option>
          ))}
        </datalist>
      </div>
    </div>
  );
}

function SegmentedField({
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
    <div className="field segmentedField">
      <span>{label}</span>
      <div className="segmentedOptions" role="radiogroup" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={value === option.id}
            className={value === option.id ? "active" : ""}
            onClick={() => onChange(option.id)}
          >
            {option.name}
          </button>
        ))}
      </div>
    </div>
  );
}

function DepartmentField({
  value,
  options,
  onChange,
}: {
  value: string;
  options: Option[];
  onChange: (value: string) => void;
}) {
  const selected = options.find((option) => option.id === value) ?? options[0] ?? { id: "all", name: "全部" };
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const normalizedQuery = query.trim().toLowerCase();
  const visibleOptions = (normalizedQuery
    ? options.filter(
        (option) =>
          option.name.toLowerCase().includes(normalizedQuery) || option.id.toLowerCase().includes(normalizedQuery),
      )
    : options
  ).slice(0, 10);

  const choose = (option: Option) => {
    onChange(option.id);
    setQuery("");
    setIsOpen(false);
  };

  return (
    <div className="field departmentField">
      <span>院系</span>
      <div className="comboBox">
        <input
          aria-label="院系"
          aria-expanded={isOpen}
          className="comboInput"
          placeholder={selected.name}
          value={isOpen ? query : selected.name}
          onBlur={() => setIsOpen(false)}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            setQuery("");
            setIsOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && visibleOptions[0]) {
              event.preventDefault();
              choose(visibleOptions[0]);
            }
            if (event.key === "Escape") {
              setQuery("");
              setIsOpen(false);
            }
          }}
        />
        {isOpen ? (
          <div className="comboPanel" role="listbox" aria-label="院系候选">
            {visibleOptions.length > 0 ? (
              visibleOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="option"
                  aria-selected={option.id === value}
                  className={option.id === value ? "active" : ""}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(option)}
                >
                  <span>{option.name}</span>
                </button>
              ))
            ) : (
              <div className="comboEmpty">没有匹配院系</div>
            )}
          </div>
        ) : null}
      </div>
    </div>
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
      共 {response.total} 条 · 第 {response.page} 页 · {formatDataVersion(response.dataVersion)}
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
              <td>{course.departmentName || course.departmentId || "-"}</td>
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
          course_type: current.source === "online" ? "0" : current.course_type,
          schedule_type: current.source === "online" ? "BKSKB" : current.schedule_type,
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
        <AcademicYearField
          value={filters.academic_year}
          options={yearOptions}
          onChange={(value) => update("academic_year", value)}
        />
        <SegmentedField
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
        <DepartmentField
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
