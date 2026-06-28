import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { studentApi } from "../../features/student/api";
import { apiMessage } from "../../features/student/format";
import type { ExamQuestion } from "../../features/student/types";
import "./liveExam.css";
import WebcamCapture from "../../features/proctor/WebcamCapture";
import CameraPermission from "../../features/proctor/CameraPermission";
import { useAuthStore } from "../../store/authStore";

interface AnswerState {
  selected_option_id?: string | null;
  selected_option_ids?: string[];
  answer_text?: string;
  is_marked_for_review: boolean;
  time_spent_sec: number;
}

export default function LiveExam() {
  const { scheduleId } = useParams();
  const navigate = useNavigate();
  const sessionQuery = useQuery({
    queryKey: ["exam-session", scheduleId],
    queryFn: () => studentApi.examSession(scheduleId!),
    enabled: Boolean(scheduleId),
    retry: false,
  });
  const answersQuery = useQuery({
    queryKey: ["exam-answers", sessionQuery.data?.attempt.id],
    queryFn: () => studentApi.savedAnswers(sessionQuery.data!.attempt.id),
    enabled: Boolean(sessionQuery.data?.attempt.id),
  });
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [visited, setVisited] = useState<Set<string>>(new Set());
  const [remaining, setRemaining] = useState(0);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraCleared, setCameraCleared] = useState(false);
  const dirty = useRef(new Set<string>());
  const submitted = useRef(false);
  const enteredQuestionAt = useRef(Date.now());
  const session = sessionQuery.data;
  const currentUser = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!answersQuery.data) return;
    setAnswers(Object.fromEntries(answersQuery.data.map((answer) => [
      answer.question_id,
      {
        selected_option_id: answer.selected_option_id,
        selected_option_ids: answer.selected_option_ids ?? [],
        answer_text: answer.answer_text ?? "",
        is_marked_for_review: answer.is_marked_for_review,
        time_spent_sec: answer.time_spent_sec,
      },
    ])));
  }, [answersQuery.data]);

  useEffect(() => {
    if (!session) return;
    const update = () => setRemaining(Math.max(0, Math.floor((new Date(session.effective_deadline).getTime() - Date.now()) / 1000)));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [session]);

  const submit = async (type: "MANUAL" | "AUTO") => {
    if (!session || submitted.current) return;
    submitted.current = true;
    setSubmitting(true);
    setError(null);
    try {
      await flushAnswers();
      await studentApi.submitAttempt(session.attempt.id, type);
      navigate("/student/history", { replace: true, state: { submitted: true } });
    } catch (cause) {
      submitted.current = false;
      setError(apiMessage(cause));
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (
      session
      && remaining === 0
      && Date.now() >= new Date(session.effective_deadline).getTime()
      && !submitted.current
    ) void submit("AUTO");
    // submit is intentionally driven by the deadline transition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, session]);

  useEffect(() => {
    if (!session) return;
    const rule = Array.isArray(session.exam.exam_rules) ? session.exam.exam_rules[0] : session.exam.exam_rules;
    const interval = Math.max(5, rule?.auto_save_interval_sec ?? 30) * 1000;
    const timer = window.setInterval(() => void flushAnswers().catch(() => undefined), interval);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, answers]);

  useEffect(() => {
    if (!session) return;
    const visibility = () => {
      if (document.hidden) void studentApi.logEvent(session.attempt.id, "TAB_SWITCH_WARNING").catch(() => undefined);
    };
    const online = () => void studentApi.logEvent(session.attempt.id, "CONNECTION_RESTORED").catch(() => undefined);
    const offline = () => void studentApi.logEvent(session.attempt.id, "CONNECTION_LOST").catch(() => undefined);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, [session]);

  const questions = session?.questions ?? [];
  const row = questions[index];
  const question = row?.questions;
  const currentAnswer = question ? answers[question.id] ?? emptyAnswer() : emptyAnswer();

  const flushAnswers = async () => {
    if (!session || !dirty.current.size) return;
    const ids = [...dirty.current];
    setSaving(true);
    try {
      await Promise.all(ids.map((questionId) => studentApi.saveAnswer({
        attempt_id: session.attempt.id,
        question_id: questionId,
        ...answers[questionId],
      })));
      ids.forEach((id) => dirty.current.delete(id));
      setLastSaved(new Date());
    } catch (cause) {
      setError(`Auto-save failed: ${apiMessage(cause)}`);
      throw cause;
    } finally {
      setSaving(false);
    }
  };

  const changeAnswer = (next: Partial<AnswerState>) => {
    if (!question) return;
    const elapsed = Math.floor((Date.now() - enteredQuestionAt.current) / 1000);
    const value = { ...currentAnswer, ...next, time_spent_sec: currentAnswer.time_spent_sec + elapsed };
    enteredQuestionAt.current = Date.now();
    setAnswers((state) => ({ ...state, [question.id]: value }));
    dirty.current.add(question.id);
  };

  const goTo = (nextIndex: number) => {
    if (!session || !question || nextIndex < 0 || nextIndex >= questions.length) return;
    const action = hasAnswer(currentAnswer) ? "ANSWERED" : "SKIPPED";
    void studentApi.navigate({ attempt_id: session.attempt.id, question_id: question.id, action }).catch(() => undefined);
    void flushAnswers().catch(() => undefined);
    setVisited((state) => new Set(state).add(question.id));
    setIndex(nextIndex);
    enteredQuestionAt.current = Date.now();
  };

  const summary = useMemo(() => {
    const values = questions.map((item) => answers[item.questions.id] ?? emptyAnswer());
    return {
      answered: values.filter(hasAnswer).length,
      flagged: values.filter((item) => item.is_marked_for_review).length,
      unanswered: values.filter((item) => !hasAnswer(item)).length,
    };
  }, [answers, questions]);

  // ── Camera gate — show before exam renders ──────────────────────────────
  if (session && !cameraCleared) {
    const rule = Array.isArray(session.exam.exam_rules)
      ? session.exam.exam_rules[0]
      : session.exam.exam_rules;
    const courseCode = session.exam.courses?.code ?? "";
    return (
      <CameraPermission
        examTitle={session.exam.title}
        courseCode={courseCode}
        cameraRequired={rule?.fullscreen_required ?? true}
        onProceed={() => setCameraCleared(true)}
        onSkip={() => setCameraCleared(true)}
      />
    );
  }

  if (sessionQuery.isLoading || answersQuery.isLoading) return <div className="exam-state"><span className="spinner" />Preparing your secure exam session...</div>;
  if (sessionQuery.error || !session) return <div className="exam-state error"><i className="ti ti-alert-triangle" /><h2>Unable to open exam</h2><p>{apiMessage(sessionQuery.error)}</p><button className="btn btn-primary" onClick={() => navigate("/student/registered")}>Back to Registered Exams</button></div>;
  if (!question) return <div className="exam-state error"><h2>No questions configured</h2><p>This exam cannot be attempted until faculty add questions.</p><button className="btn btn-primary" onClick={() => navigate("/student/registered")}>Go Back</button></div>;

  const rule = Array.isArray(session.exam.exam_rules) ? session.exam.exam_rules[0] : session.exam.exam_rules;
  const danger = remaining <= 300;
  return <div className="live-exam">
    <header className="live-header">
      <div className="live-title"><strong>EXAM.TIET</strong><span>{session.exam.courses?.code} · {session.exam.title}</span></div>
      <div className={`live-timer ${danger ? "danger" : ""}`}><i className="ti ti-clock" /><span>Time remaining</span><strong>{formatRemaining(remaining)}</strong></div>
      <div className="save-state"><span className={saving ? "saving" : ""} /><span>{saving ? "Saving..." : lastSaved ? `Saved ${lastSaved.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Progress restored"}</span></div>
    </header>
    {error && <div className="exam-error"><i className="ti ti-alert-circle" />{error}<button onClick={() => setError(null)}><i className="ti ti-x" /></button></div>}
    <div className="live-body">
      <main className="question-pane">
        <div className="question-scroll">
          <div className="question-meta"><span>Question {index + 1} of {questions.length}</span><div><b>{row.marks_override ?? question.marks} marks</b>{question.negative_marks > 0 && <b className="negative">-{question.negative_marks} negative</b>}<b>{question.question_type.replace("_", " ")}</b></div></div>
          <h1>{question.question_text}</h1>
          <AnswerInput question={row} answer={currentAnswer} onChange={changeAnswer} />
          <div className="question-tools">
            <button className={currentAnswer.is_marked_for_review ? "flagged" : ""} onClick={() => changeAnswer({ is_marked_for_review: !currentAnswer.is_marked_for_review })}><i className="ti ti-flag" />{currentAnswer.is_marked_for_review ? "Marked for review" : "Mark for review"}</button>
            <button onClick={() => changeAnswer({ selected_option_id: null, selected_option_ids: [], answer_text: "" })}><i className="ti ti-eraser" />Clear response</button>
          </div>
        </div>
        <footer className="question-nav">
          <button className="btn btn-secondary" disabled={index === 0} onClick={() => goTo(index - 1)}><i className="ti ti-arrow-left" />Previous</button>
          <div>
            <button className="btn btn-danger" onClick={() => setSubmitOpen(true)}>Submit Exam</button>
            <button className="btn btn-primary" disabled={index === questions.length - 1} onClick={() => goTo(index + 1)}>Save & Next<i className="ti ti-arrow-right" /></button>
          </div>
        </footer>
      </main>
      <aside className="question-palette">
        <div className="palette-head"><strong>Question Palette</strong><span>{summary.answered}/{questions.length} answered</span></div>
        <div className="palette-grid">{questions.map((item, questionIndex) => {
          const answer = answers[item.questions.id] ?? emptyAnswer();
          const className = `${questionIndex === index ? "current" : ""} ${answer.is_marked_for_review ? "flagged" : hasAnswer(answer) ? "answered" : visited.has(item.questions.id) ? "visited" : ""}`;
          return <button className={className} key={item.questions.id} onClick={() => goTo(questionIndex)}>{questionIndex + 1}</button>;
        })}</div>
        <div className="palette-legend"><span><i className="answered" />Answered: {summary.answered}</span><span><i className="flagged" />Review: {summary.flagged}</span><span><i />Unanswered: {summary.unanswered}</span></div>
        {rule?.fullscreen_required && <button className="btn btn-secondary fullscreen" onClick={() => document.documentElement.requestFullscreen().catch(() => undefined)}><i className="ti ti-maximize" />Enter Fullscreen</button>}
        <div className="timer-policy">Timer policy: your attempt closes at the earlier of the full duration or the published exam closing time.</div>
      </aside>
    </div>
    {/* Invisible webcam capture — runs silently in background */}
    {session && (
      <WebcamCapture
        attemptId={session.attempt.id}
        studentId={currentUser?.id ?? ""}
        intervalMs={30000}
      />
    )}
    {submitOpen && <div className="modal-backdrop"><section className="modal"><div className="modal-header"><h2>Submit examination?</h2><button onClick={() => setSubmitOpen(false)}><i className="ti ti-x" /></button></div><div className="modal-body"><p>You have answered <strong>{summary.answered}</strong> of {questions.length} questions. {summary.unanswered > 0 && `${summary.unanswered} remain unanswered.`}</p><div className="detail-grid" style={{ marginTop: 14 }}><div className="detail-item"><span>Answered</span><strong>{summary.answered}</strong></div><div className="detail-item"><span>Marked for review</span><strong>{summary.flagged}</strong></div></div></div><div className="modal-footer"><button className="btn btn-secondary" onClick={() => setSubmitOpen(false)}>Continue Exam</button><button className="btn btn-primary" disabled={submitting} onClick={() => void submit("MANUAL")}>{submitting ? "Submitting..." : "Confirm Submit"}</button></div></section></div>}
  </div>;
}

function AnswerInput({ question: row, answer, onChange }: { question: ExamQuestion; answer: AnswerState; onChange: (value: Partial<AnswerState>) => void }) {
  const question = row.questions;
  if (question.question_type === "SHORT_ANSWER" || question.question_type === "LONG_ANSWER") {
    return <textarea className="answer-text" rows={question.question_type === "LONG_ANSWER" ? 10 : 4} value={answer.answer_text ?? ""} onChange={(event) => onChange({ answer_text: event.target.value })} placeholder="Type your answer here..." />;
  }
  const multiple = question.question_type === "MSQ";
  return <div className="answer-options">{question.question_options.sort((a, b) => a.order_index - b.order_index).map((option, index) => {
    const selected = multiple ? answer.selected_option_ids?.includes(option.id) : answer.selected_option_id === option.id;
    const choose = () => {
      if (!multiple) return onChange({ selected_option_id: option.id });
      const values = new Set(answer.selected_option_ids ?? []);
      if (values.has(option.id)) values.delete(option.id); else values.add(option.id);
      onChange({ selected_option_ids: [...values] });
    };
    return <button className={selected ? "selected" : ""} onClick={choose} key={option.id}><span>{String.fromCharCode(65 + index)}</span><i className={`ti ti-${multiple ? selected ? "square-check-filled" : "square" : selected ? "circle-dot-filled" : "circle"}`} /><p>{option.option_text}</p></button>;
  })}</div>;
}

function emptyAnswer(): AnswerState { return { selected_option_id: null, selected_option_ids: [], answer_text: "", is_marked_for_review: false, time_spent_sec: 0 }; }
function hasAnswer(answer: AnswerState) { return Boolean(answer.selected_option_id || answer.selected_option_ids?.length || answer.answer_text?.trim()); }
function formatRemaining(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds / 60) % 60;
  const remainingSeconds = seconds % 60;
  return [hours, minutes, remainingSeconds].map((value) => String(value).padStart(2, "0")).join(":");
}