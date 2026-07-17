import FacultyLayout from "../../features/faculty/FacultyLayout";
import { PageState, PageHeading } from "../../features/faculty/components";
import { useFacultyDashboard } from "../../features/faculty/hooks";
import { initials } from "../../features/faculty/format";

export default function Profile() {
  const { data: portal, isLoading } = useFacultyDashboard();
  const profile = portal?.profile;

  return (
    <FacultyLayout activePage="profile">
      <PageState loading={isLoading}>
        <PageHeading title="Faculty Profile" subtitle="Your faculty account information" />
        <div className="faculty-profile-layout">
          <aside className="faculty-profile-card">
            <div className="faculty-profile-avatar">
              {initials(profile?.full_name ?? "")}
            </div>
            <span className="faculty-profile-kicker">Faculty account</span>
            <h2>{profile?.full_name}</h2>
            <p>{profile?.email}</p>
            <p>{profile?.departments?.name || "Department not set"}</p>
          </aside>
          <div className="panel faculty-profile-details">
            <div className="panel-header"><h2>Information</h2></div>
            <div className="panel-body form-grid">
              <div className="form-field">
                <label>Full Name</label>
                <input className="field" value={profile?.full_name || ""} disabled />
              </div>
              <div className="form-field">
                <label>Email</label>
                <input className="field" value={profile?.email || ""} disabled />
              </div>
              <div className="form-field">
                <label>Phone</label>
                <input className="field" value={profile?.phone || ""} disabled />
              </div>
              <div className="form-field full">
                <label>Department</label>
                <input className="field" value={profile?.departments?.name || "Not set"} disabled />
              </div>
            </div>
          </div>
        </div>
      </PageState>
    </FacultyLayout>
  );
}
