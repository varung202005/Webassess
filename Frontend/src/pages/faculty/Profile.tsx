import FacultyLayout from "../../features/faculty/FacultyLayout";
import { PageState, PageHeading } from "../../features/faculty/components";
import { useFacultyDashboard } from "../../features/faculty/hooks";
import { initials } from "../../features/faculty/format";

export default function Profile() {
  const { data: portal, isLoading } = useFacultyDashboard();
  const profile = portal?.profile;

  return (
    <FacultyLayout activePage="dashboard">
      <PageState loading={isLoading}>
        <PageHeading title="Faculty Profile" subtitle="Your faculty account information" />
        <div style={{ display: "grid", gridTemplateColumns: "210px minmax(0,1fr)", gap: 18 }}>
          <aside style={{ padding: 22, textAlign: "center", background: "#fff", border: "1px solid #e5e7ed", borderRadius: 18 }}>
            <div style={{ width: 76, height: 76, borderRadius: 24, margin: "0 auto 12px", background: "#fde8ec", color: "#a30f2e", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 22 }}>
              {initials(profile?.full_name ?? "")}
            </div>
            <h2 style={{ fontSize: 17 }}>{profile?.full_name}</h2>
            <p style={{ fontSize: 11, color: "#7c808f", marginTop: 4 }}>{profile?.email}</p>
            <p style={{ fontSize: 11, color: "#7c808f", marginTop: 4 }}>{profile?.departments?.name || "Department not set"}</p>
          </aside>
          <div className="panel" style={{ margin: 0 }}>
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
