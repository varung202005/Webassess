import PlaceholderPage from "../../components/PlaceholderPage";

export default function Registered() {
  return (
    <PlaceholderPage
      title="Registered Exams"
      description="List of exam schedules the student has registered for, with countdowns and 'Start Exam' actions once the eligibility window opens."
      apiHint="GET /exam-registrations/?student_id=me"
    />
  );
}
