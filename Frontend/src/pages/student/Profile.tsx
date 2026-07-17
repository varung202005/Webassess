import { useEffect, useState, type FormEvent } from "react";
import StudentLayout, { Feedback, PageState } from "../../features/student/StudentLayout";
import { PageHeading } from "../../features/student/components";
import { studentApi } from "../../features/student/api";
import { apiMessage, initials } from "../../features/student/format";
import { usePortalAction, useStudentPortal } from "../../features/student/hooks";

export default function Profile() {
  const portal = useStudentPortal();
  const update = usePortalAction((body: Record<string, unknown>) => studentApi.updateProfile(body));
  const [form, setForm] = useState({ full_name: "", phone: "", profile_photo: "", roll_number: "", department_id: "", semester: "" });
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!portal.data) return;
    const profile = portal.data.profile;
    setForm({ full_name: profile.full_name || "", phone: profile.phone || "", profile_photo: profile.profile_photo || "", roll_number: profile.roll_number || "", department_id: profile.department_id || "", semester: profile.semester ? String(profile.semester) : "" });
  }, [portal.data]);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(null);
    try { await update.mutateAsync({ ...form, semester: form.semester ? Number(form.semester) : null, department_id: form.department_id || null }); setFeedback("Profile updated successfully."); }
    catch (cause) { setError(apiMessage(cause)); }
  };
  const profile = portal.data?.profile;
  return <StudentLayout><PageState loading={portal.isLoading} error={portal.error}>
    <PageHeading title="Profile" subtitle="Manage your personal and academic information" />
    <Feedback message={feedback} error={error} />
    <div className="profile-card profile-page-card">
      <aside className="profile-summary profile-identity">{profile?.profile_photo ? <img className="avatar" src={profile.profile_photo} alt="" /> : <div className="avatar">{initials(profile?.full_name)}</div>}<span className="profile-kicker">Student account</span><h2>{profile?.full_name}</h2><p>{profile?.email}</p><div className="profile-facts"><div><i className="ti ti-id" /><span>Roll number</span><strong>{profile?.roll_number || "Not set"}</strong></div><div><i className="ti ti-school" /><span>Department</span><strong>{profile?.departments?.name || "Not set"}</strong></div><div><i className="ti ti-calendar-event" /><span>Semester</span><strong>{profile?.semester ? `Semester ${profile.semester}` : "Not set"}</strong></div></div></aside>
      <form className="panel profile-form-panel" onSubmit={submit}><div className="panel-header"><div><span className="form-kicker">Account settings</span><h2>Student information</h2></div></div><div className="panel-body">
        <div className="profile-form-section"><div className="profile-form-heading"><i className="ti ti-user" /><div><h3>Personal details</h3><p>Keep your contact information current.</p></div></div><div className="form-grid">
          <Field label="Full Name"><input className="field" required value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} /></Field>
          <Field label="Email"><input className="field" disabled value={profile?.email || ""} /></Field>
          <Field label="Roll Number"><input className="field" value={form.roll_number} onChange={(event) => setForm({ ...form, roll_number: event.target.value })} /></Field>
          <Field label="Phone"><input className="field" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></Field>
        </div></div>
        <div className="profile-form-section"><div className="profile-form-heading"><i className="ti ti-school" /><div><h3>Academic details</h3><p>These details help tailor your exam workspace.</p></div></div><div className="form-grid">
          <Field label="Department"><select className="select" value={form.department_id} onChange={(event) => setForm({ ...form, department_id: event.target.value })}><option value="">Select department</option>{portal.data?.departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
          <Field label="Semester"><select className="select" value={form.semester} onChange={(event) => setForm({ ...form, semester: event.target.value })}><option value="">Select semester</option>{Array.from({ length: 12 }, (_, index) => index + 1).map((item) => <option key={item} value={item}>{item}</option>)}</select></Field>
          <div className="form-field full"><label>Profile Photo URL</label><input className="field" type="url" value={form.profile_photo} onChange={(event) => setForm({ ...form, profile_photo: event.target.value })} placeholder="Supabase Storage public URL" /></div>
        </div></div>
        <div className="profile-form-actions"><button className="btn btn-primary" disabled={update.isPending} type="submit">{update.isPending ? "Saving changes..." : "Save changes"}</button></div>
      </div></form>
    </div>
  </PageState></StudentLayout>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="form-field"><label>{label}</label>{children}</div>; }
