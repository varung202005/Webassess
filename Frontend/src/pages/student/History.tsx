import PlaceholderPage from "../../components/PlaceholderPage";

export default function History() {
  return (
    <PlaceholderPage
      title="Exam History"
      description="Past exam attempts (SUBMITTED / AUTO_SUBMITTED / ABSENT / INVALIDATED) with links through to published results."
      apiHint="GET /exam-attempts/?student_id=me"
    />
  );
}
