"use client";

import { FormEvent, useEffect, useState } from "react";

export type StaffData = {
  schools: { id: string; name: string; code: string }[];
  school: { id: string; name: string; code: string };
  classes: { id: string; name: string; level: string | null }[];
  subjects: { id: string; name: string; code: string | null }[];
  sessions: { id: string; name: string; is_current: boolean }[];
  invitations: {
    id: string; email: string; first_name: string; last_name: string; role: string;
    staff_code: string; status: string; expires_at: string; accepted_at: string | null; created_at: string;
  }[];
};

type Assignment = { classId: string; subjectId: string; academicSessionId: string };

export default function StaffManagementClient({ initialData }: { initialData: StaffData }) {
  const [data, setData] = useState<StaffData>(initialData);
  const [schoolId, setSchoolId] = useState(initialData.school.id);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(false);
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
    void load(initialData.school.id);
    // The initial data gives the page an immediate first paint; revalidation keeps the list current.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addAssignment() {
    if (!data.classes.length || !data.subjects.length || !data.sessions.length) return;
    setAssignments((current) => [...current, {
      classId: data.classes[0].id,
      subjectId: data.subjects[0].id,
      academicSessionId: data.sessions.find((session) => session.is_current)?.id ?? data.sessions[0].id,
    }]);
  }

  function updateAssignment(index: number, field: keyof Assignment, value: string) {
    setAssignments((current) => current.map((assignment, itemIndex) =>
      itemIndex === index ? { ...assignment, [field]: value } : assignment,
    ));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setNotice("");

    const response = await fetch("/api/staff/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create", schoolId, firstName, lastName, email, assignments }),
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
    if (!window.confirm("Revoke this invitation? The pending school membership will be deactivated.")) return;
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

  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">STAFF MANAGEMENT</p>
          <h1>Add a teacher.</h1>
          <p className="muted">Invite a teacher with their real email address, then give them the class and subject context they need.</p>
          <div className="context-strip">
            <span className="context-chip"><strong>{data.school.code}</strong> {data.school.name}</span>
            <span className="context-chip">Role <strong>School administrator</strong></span>
          </div>
        </div>
        <span className="live-indicator"><span aria-hidden="true" /> Live staff workspace</span>
      </section>

      {data.schools.length > 1 && (
        <div className="surface section-card" style={{ marginBottom: 16 }}>
          <label className="field">
            School workspace
            <select value={schoolId} onChange={(event) => void load(event.target.value)} disabled={loading}>
              {data.schools.map((school) => <option key={school.id} value={school.id}>{school.name} ({school.code})</option>)}
            </select>
          </label>
        </div>
      )}

      <div className="staff-layout">
        <section className="surface form-card">
          <div className="section-heading"><div><h2>Invite teacher</h2><p>Send a secure account invitation. They will create their password themselves.</p></div></div>
          <form onSubmit={handleSubmit} className="staff-form">
            <div className="form-grid">
              <label className="field">First name<input value={firstName} onChange={(event) => setFirstName(event.target.value)} placeholder="Sarah" autoComplete="given-name" required /></label>
              <label className="field">Last name<input value={lastName} onChange={(event) => setLastName(event.target.value)} placeholder="Johnson" autoComplete="family-name" required /></label>
            </div>
            <label className="field">Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="sarah@example.com" autoComplete="email" required /></label>

            <div className="assignment-section">
              <div className="section-heading"><div><h2>Teaching assignments</h2><p>Add the class, subject and academic session this teacher will work with.</p></div><button type="button" className="button-secondary" onClick={addAssignment} disabled={!data.classes.length || !data.subjects.length || !data.sessions.length}>+ Add assignment</button></div>
              {assignments.length === 0 ? <p className="empty-state">No assignments yet. You can invite the teacher first and add academic assignments later.</p> : (
                <div className="assignment-list">
                  {assignments.map((assignment, index) => (
                    <div className="assignment-row" key={`${index}-${assignment.classId}-${assignment.subjectId}`}>
                      <select value={assignment.classId} onChange={(event) => updateAssignment(index, "classId", event.target.value)} aria-label={`Class for assignment ${index + 1}`}>{data.classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
                      <select value={assignment.subjectId} onChange={(event) => updateAssignment(index, "subjectId", event.target.value)} aria-label={`Subject for assignment ${index + 1}`}>{data.subjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
                      <select value={assignment.academicSessionId} onChange={(event) => updateAssignment(index, "academicSessionId", event.target.value)} aria-label={`Academic session for assignment ${index + 1}`}>{data.sessions.map((session) => <option key={session.id} value={session.id}>{session.name}{session.is_current ? " (Current)" : ""}</option>)}</select>
                      <button type="button" className="icon-button" onClick={() => setAssignments((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove assignment ${index + 1}`}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {error && <p className="error" role="alert">{error}</p>}
            {notice && <p className="success" role="status">{notice}</p>}
            <div className="form-footer"><p>Account activation happens from the teacher’s invitation email.</p><button className="btn btn-primary" type="submit" disabled={submitting || !schoolId}>{submitting ? "Sending invitation…" : "Send invitation"}</button></div>
          </form>
        </section>

        <section className="surface section-card">
          <div className="section-heading"><div><h2>Invitation history</h2><p>Pending teachers remain inactive until they complete account setup.</p></div><span className="count-badge">{data.invitations.length}</span></div>
          {!data.invitations.length ? <div className="empty-state"><strong>No invitations yet.</strong><p style={{ margin: "6px 0 0" }}>Your first teacher invitation will appear here with its Staff ID and activation status.</p></div> : (
            <div className="invitation-list">
              {data.invitations.map((invitation) => (
                <article className="invitation-card" key={invitation.id}>
                  <div className="invitation-person"><span className="avatar avatar-soft" aria-hidden="true">{invitation.first_name.charAt(0)}{invitation.last_name.charAt(0)}</span><div><strong>{invitation.first_name} {invitation.last_name}</strong><p>{invitation.email}</p><span>{invitation.staff_code} · {invitation.role}</span></div></div>
                  <div className="invitation-meta"><span className={`status status-${invitation.status}`}>{invitation.status}</span>{invitation.status === "pending" && <button type="button" className="button-danger" onClick={() => void revokeInvitation(invitation.id)}>Revoke</button>}</div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
