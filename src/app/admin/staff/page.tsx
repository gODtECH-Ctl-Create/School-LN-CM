"use client";

import { FormEvent, useEffect, useState } from "react";

type School = { id: string; name: string; code: string };
type ClassItem = { id: string; name: string; level: string | null };
type SubjectItem = { id: string; name: string; code: string | null };
type Session = { id: string; name: string; is_current: boolean };
type Invitation = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  staff_code: string;
  status: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
};
type Assignment = { classId: string; subjectId: string; academicSessionId: string };

type StaffData = {
  schools: School[];
  school: School;
  classes: ClassItem[];
  subjects: SubjectItem[];
  sessions: Session[];
  invitations: Invitation[];
};

export default function StaffManagementPage() {
  const [data, setData] = useState<StaffData | null>(null);
  const [schoolId, setSchoolId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load(nextSchoolId?: string) {
    setLoading(true);
    setError("");
    const query = nextSchoolId ? `?schoolId=${encodeURIComponent(nextSchoolId)}` : "";
    const response = await fetch(`/api/staff/invitations${query}`, { cache: "no-store" });
    const result = (await response.json()) as StaffData & { error?: string };

    if (!response.ok) {
      setError(result.error ?? "Unable to load staff management.");
      setLoading(false);
      return;
    }

    setData(result);
    setSchoolId(result.school.id);
    setAssignments([]);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  function addAssignment() {
    if (!data?.classes.length || !data.subjects.length || !data.sessions.length) return;
    setAssignments((current) => [
      ...current,
      {
        classId: data.classes[0].id,
        subjectId: data.subjects[0].id,
        academicSessionId: data.sessions.find((session) => session.is_current)?.id ?? data.sessions[0].id,
      },
    ]);
  }

  function updateAssignment(index: number, field: keyof Assignment, value: string) {
    setAssignments((current) =>
      current.map((assignment, itemIndex) =>
        itemIndex === index ? { ...assignment, [field]: value } : assignment,
      ),
    );
  }

  function removeAssignment(index: number) {
    setAssignments((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setNotice("");

    const response = await fetch("/api/staff/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        schoolId,
        firstName,
        lastName,
        email,
        assignments,
      }),
    });
    const result = (await response.json()) as { error?: string; message?: string; staffCode?: string };

    if (!response.ok) {
      setError(result.error ?? "Unable to send invitation.");
      setSubmitting(false);
      return;
    }

    setFirstName("");
    setLastName("");
    setEmail("");
    setAssignments([]);
    setNotice(`${result.message ?? "Invitation sent."} Staff ID: ${result.staffCode ?? "generated"}.`);
    setSubmitting(false);
    await load(schoolId);
  }

  async function revokeInvitation(invitationId: string) {
    setError("");
    setNotice("");
    const response = await fetch("/api/staff/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "revoke", schoolId, invitationId }),
    });
    const result = (await response.json()) as { error?: string };

    if (!response.ok) {
      setError(result.error ?? "Unable to revoke invitation.");
      return;
    }

    setNotice("Invitation revoked.");
    await load(schoolId);
  }

  if (loading && !data) {
    return <main className="shell"><section className="card-wide"><p className="muted">Loading staff management...</p></section></main>;
  }

  return (
    <main className="shell">
      <section className="card-wide">
        <div className="page-heading">
          <div>
            <p className="eyebrow">STAFF</p>
            <h1>Add a teacher.</h1>
            <p className="muted">Invite teachers with their real email address. Staff IDs remain internal school identifiers.</p>
          </div>
          <a className="text-link" href="/">Back to workspace</a>
        </div>

        {data && data.schools.length > 1 && (
          <label className="field">
            School
            <select
              value={schoolId}
              onChange={(event) => void load(event.target.value)}
            >
              {data.schools.map((school) => (
                <option key={school.id} value={school.id}>{school.name} ({school.code})</option>
              ))}
            </select>
          </label>
        )}

        <form onSubmit={handleSubmit} className="staff-form">
          <div className="form-grid">
            <label className="field">
              First name
              <input value={firstName} onChange={(event) => setFirstName(event.target.value)} placeholder="Sarah" required />
            </label>
            <label className="field">
              Last name
              <input value={lastName} onChange={(event) => setLastName(event.target.value)} placeholder="Johnson" required />
            </label>
          </div>

          <label className="field">
            Email address
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="sarah@example.com" required />
          </label>

          <div className="assignment-section">
            <div className="section-heading">
              <div>
                <h2>Teaching assignments</h2>
                <p className="muted">Optional now. Add the class, subject and academic session the teacher owns.</p>
              </div>
              <button type="button" className="button-secondary" onClick={addAssignment} disabled={!data?.classes.length || !data?.subjects.length || !data?.sessions.length}>
                + Add assignment
              </button>
            </div>

            {assignments.length === 0 && <p className="empty-state">No assignments added yet.</p>}

            <div className="assignment-list">
              {assignments.map((assignment, index) => (
                <div className="assignment-row" key={`${index}-${assignment.classId}-${assignment.subjectId}`}>
                  <select value={assignment.classId} onChange={(event) => updateAssignment(index, "classId", event.target.value)} aria-label="Class">
                    {data?.classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                  <select value={assignment.subjectId} onChange={(event) => updateAssignment(index, "subjectId", event.target.value)} aria-label="Subject">
                    {data?.subjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                  <select value={assignment.academicSessionId} onChange={(event) => updateAssignment(index, "academicSessionId", event.target.value)} aria-label="Academic session">
                    {data?.sessions.map((session) => <option key={session.id} value={session.id}>{session.name}{session.is_current ? " (Current)" : ""}</option>)}
                  </select>
                  <button type="button" className="icon-button" onClick={() => removeAssignment(index)} aria-label="Remove assignment">×</button>
                </div>
              ))}
            </div>
          </div>

          {error && <p className="error">{error}</p>}
          {notice && <p className="success">{notice}</p>}

          <button className="primary-button" type="submit" disabled={submitting || !schoolId}>
            {submitting ? "Sending invitation..." : "Send invitation"}
          </button>
        </form>

        <div className="staff-list-section">
          <div className="section-heading">
            <div>
              <h2>Invitations</h2>
              <p className="muted">Pending teachers stay inactive until they finish account setup.</p>
            </div>
          </div>

          {!data?.invitations.length && <p className="empty-state">No invitations have been sent for this school.</p>}
          <div className="invitation-list">
            {data?.invitations.map((invitation) => (
              <article className="invitation-card" key={invitation.id}>
                <div>
                  <strong>{invitation.first_name} {invitation.last_name}</strong>
                  <p>{invitation.email}</p>
                  <span>{invitation.staff_code} · {invitation.role}</span>
                </div>
                <div className="invitation-meta">
                  <span className={`status status-${invitation.status}`}>{invitation.status}</span>
                  {invitation.status === "pending" && (
                    <button type="button" className="button-danger" onClick={() => void revokeInvitation(invitation.id)}>
                      Revoke
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
