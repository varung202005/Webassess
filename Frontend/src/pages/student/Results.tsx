import { useMemo, useState } from "react";
import StudentLayout, { EmptyState, PageState } from "../../features/student/StudentLayout";
import { downloadResult, PageHeading, ResultModal } from "../../features/student/components";
import { formatDate } from "../../features/student/format";
import { useStudentPortal } from "../../features/student/hooks";
import type { Result } from "../../features/student/types";

export default function Results() {
  const portal = useStudentPortal();
  const [search, setSearch] = useState("");
  const [semester, setSemester] = useState("ALL");
  const [selected, setSelected] = useState<Result | null>(null);
  const results = useMemo(() => (portal.data?.results ?? []).filter((item) => {
    const matches = `${item.exam.title} ${item.course.code} ${item.course.name}`.toLowerCase().includes(search.toLowerCase());
    return matches && (semester === "ALL" || String(item.exam.semester) === semester);
  }), [portal.data?.results, search, semester]);
  const average = results.length ? results.reduce((sum, item) => sum + item.percentage, 0) / results.length : 0;

  return <StudentLayout><PageState loading={portal.isLoading} error={portal.error}>
    <PageHeading title="My Results" subtitle="Published marks, rank, percentile, and faculty feedback" />
    <div className="stats-grid">
      <MiniStat label="Published Results" value={String(results.length)} />
      <MiniStat label="Average" value={results.length ? `${average.toFixed(1)}%` : "—"} />
      <MiniStat label="Passed" value={String(results.filter((item) => item.is_passed).length)} />
      <MiniStat label="Best Rank" value={results.some((item) => item.rank) ? `#${Math.min(...results.map((item) => item.rank || Infinity))}` : "—"} />
    </div>
    <div className="filter-panel compact-filter-panel"><div className="filter-control search-control" onClick={(event) => event.currentTarget.querySelector("input")?.focus()}><i className="ti ti-search" /><label className="visually-hidden" htmlFor="results-search">Search results</label><input id="results-search" type="search" className="field" placeholder="Search results" value={search} onInput={(event) => setSearch(event.currentTarget.value)} /></div><div className="filter-control"><i className="ti ti-school" /><label className="visually-hidden" htmlFor="results-semester">Semester</label><select id="results-semester" className="select" value={semester} onChange={(event) => setSemester(event.target.value)}><option value="ALL">All semesters</option>{Array.from({ length: 12 }, (_, index) => index + 1).map((item) => <option value={item} key={item}>Semester {item}</option>)}</select></div></div>
    {!results.length ? <EmptyState icon="ti-award-off" title="No published results" body="Results will appear after they are published by the examination team." /> :
      <div className="data-panel"><table className="data-table"><thead><tr><th>Exam</th><th>Published</th><th>Marks</th><th>Percentage</th><th>Rank</th><th>Percentile</th><th>Status</th><th>Actions</th></tr></thead><tbody>{results.map((result) => <tr key={result.id}>
        <td><strong>{result.exam.title}</strong><small>{result.course.code} · {result.course.name}</small></td><td>{formatDate(result.published_at)}</td><td className="score">{result.total_score} / {result.max_score}</td><td>{result.percentage.toFixed(2)}%</td><td>{result.rank ? `#${result.rank}` : "—"}</td><td>{result.percentile != null ? `${result.percentile.toFixed(2)}th` : "—"}</td><td><span className={`status-pill ${result.is_passed ? "success" : "danger"}`}>{result.is_passed ? "Pass" : "Fail"}</span></td><td><div className="card-actions"><button className="btn btn-secondary" onClick={() => setSelected(result)}>View Result</button><button className="btn btn-ghost" onClick={() => downloadResult(result)}><i className="ti ti-download" /></button></div></td>
      </tr>)}</tbody></table></div>}
    {selected && <ResultModal result={selected} onClose={() => setSelected(null)} />}
  </PageState></StudentLayout>;
}
function MiniStat({ label, value }: { label: string; value: string }) { return <div className="stat-card"><div className="stat-top">{label}</div><div className="stat-value">{value}</div></div>; }
