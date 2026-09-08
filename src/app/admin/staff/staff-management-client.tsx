"use client";

import { FormEvent, useState } from "react";

export type StaffData = {
  schools: { id: string; name: string; code: string }[];
  school: { id: string; name: string; code: string };
  classes: { id: string; name: string; level: string | null }[];
  subjects: { id: string; name: string; code: string | null }[];
  sessions: { id: string; name: string; is_current: boolean }[];
  invitations: {
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
  }[];
  teachers: {
    membershipId: string;
    firstName: string;
    lastName: string;
    staffCode: string;
    isHeadTeacher: boolean;
    assignments: number;
  }[];
};

type Assignment = { classId: string; subjectId: string; academicSessionId: string };

export default function StaffManagementClient({ initialData }: { initialData: StaffData }) {
  const [data, setData] = useState<StaffData>(initialData);
  const schoolId = initialData.school.id;
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [changingAccess, setChangingAccess] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const currentSession = data.sessions.find((session) => session.is_current) ?? data.sessions[0];
  const pendingInvitations = data.invitations.filter((invitation) => invitation.status === "pending");

  function addAssignment() {
    if (!data.classes.length || !data.subjects.length || !currentSession) return;
    setAssignments((current) => [
      ...current,
      { classId: data.classes[0].id, subjectId: data.subjects[0].id, academicSessionId: currentSession.id },
    ]);
  }

  function updateAssignment(index: number, field: keyof Omit<Assignment, "academicSessionId">, value: string) {
    setAssignments((current) => current.map((assignment, itemIndex) =>
      itemIndex === index ? { ...assignment, [field]: value } : assignment,
    ));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/staff/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", schoolId, firstName, lastName, email, assignments }),
      });
      const result = (await response.json()) as { error?: string; message?: string; staffCode?: string; invitationId?: string };
      if (!response.ok) {
        setError(result.error ?? "Unable to send invitation.");
        return;
      }

      const invitation = {
        id: result.invitationId ?? crypto.randomUUID(),
        email: email.trim().toLowerCase(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        role: "teacher",
        staff_code: result.staffCode ?? "Generated",
        status: "pending",
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        accepted_at: null,
        created_at: new Date().toISOString(),
      };

      setData((current) => ({ ...current, invitations: [invitation, ...current.invitations] }));
      setFirstName("");
      setLastName("");
      setEmail("");
      setAssignments([]);
      setNotice(`${result.message ?? "Invitation sent."} Staff ID: ${result.staffCode ?? "generated"}.`);
    } catch {
      setError("We couldn't reach the staff service. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function revokeInvitation(invitationId: string) {
    if (!window.confirm("Revoke this invitation?")) return;
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
    setData((current) => ({ ...current, invitations: current.invitations.map((invitation) => invitation.id === invitationId ? { ...invitation, status: "revoked" } : invitation) }));
    setNotice("Invitation revoked.");
  }

  async function setHeadTeacher(teacherMembershipId: string, isHeadTeacher: boolean) {
    setChangingAccess(teacherMembershipId);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/staff/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolId, teacherMembershipId, isHeadTeacher }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(result.error ?? "Unable to update teacher access.");
        return;
      }
      setData((current) => ({
        ...current,
        teachers: current.teachers.map((teacher) =>
          teacher.membershipId === teacherMembershipId ? { ...teacher, isHeadTeacher } : teacher,
        ),
      }));
      setNotice(isHeadTeacher ? "Teacher promoted to Head Teacher." : "Head Teacher access removed.");
    } catch {
      setError("We couldn't update teacher access. Try again.");
    } finally {
      setChangingAccess("");
    }
  }

  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">PEOPLE</p>
          <h1>Your teaching team.</h1>
          <p className="muted">Add teachers, give them the classes and subjects they need, and promote a trusted teacher to Head Teacher when you need wider oversight.</p>
          <div className="context-strip">
            <span className="context-chip"><strong>{data.school.code}</strong> {data.school.name}</span>
            {currentSession && <span className="context-chip">Current session <strong>{currentSession.name}</strong></span>}
          </div>
        </div>
      </section>

      {(error || notice) && <div className={error ? "form-alert form-alert-error" : "form-alert form-alert-success"} role={error ? "alert" : "status"}>{error || notice}</div>}

      <div className="staff-layout">
        <section className="surface form-card">
          <div className="section-heading">
            <div><p className="eyebrow">ADD</p><h2>Invite a teacher</h2><p>One simple form. The teacher creates their password from the invitation email.</p></div>
          </div>

          <form onSubmit={handleSubmit} className="staff-form">
            <div className="form-grid">
              <label className="field">First name<input value={firstName} onChange={(event) => setFirstName(event.target.value)} placeholder="Sarah" autoComplete="given-name" required /></label>
              <label className="field">Last name<input value={lastName} onChange={(event) => setLastName(event.target.value)} placeholder="Johnson" autoComplete="family-name" required /></label>
            </div>
            <label className="field">Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="sarah@example.com" autoComplete="email" required /></label>

            <div className="assignment-section">
              <div className="section-heading">
                <div><h2>Teaching assignments</h2><p>Current session is applied automatically.</p></div>
                <button type="button" className="button-secondary" onClick={addAssignment} disabled={!data.classes.length || !data.subjects.length || !currentSession}>+ Add assignment</button>
              </div>
              {assignments.length === 0 ? (
                <div className="empty-state"><strong>Assignments are optional.</strong><p style={{ margin: "6px 0 0" }}>Invite the teacher now and assign their classes and subjects later.</p></div>
              ) : (
                <div className="assignment-list">
                  {assignments.map((assignment, index) => (
                    <div className="assignment-row" key={`${index}-${assignment.classId}-${assignment.subjectId}`}>
                      <select value={assignment.classId} onChange={(event) => updateAssignment(index, "classId", event.target.value)} aria-label={`Class for assignment ${index + 1}`}>
                        {data.classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                      </select>
                      <select value={assignment.subjectId} onChange={(event) => updateAssignment(index, "subjectId", event.target.value)} aria-label={`Subject for assignment ${index + 1}`}>
                        {data.subjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                      </select>
                      <button type="button" className="icon-button" onClick={() => setAssignments((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove assignment ${index + 1}`}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="form-footer">
              <p>Every new account starts as Teacher. You can promote them later.</p>
              <button className="btn btn-primary" type="submit" disabled={submitting || !schoolId}>{submitting ? "Sending…" : "Send invitation"}</button>
            </div>
          </form>
        </section>

        <section className="surface section-card">
          <div className="section-heading">
            <div><p className="eyebrow">TEAM</p><h2>Active teachers</h2><p>Keep the normal teacher experience small. Add wider oversight only when needed.</p></div>
            <span className="count-badge">{data.teachers.length}</span>
          </div>

          {data.teachers.length ? (
            <div className="invitation-list">
              {data.teachers.map((teacher) => (
                <article className="invitation-card" key={teacher.membershipId}>
                  <div className="invitation-person">
                    <span className="avatar avatar-soft" aria-hidden="true">{teacher.firstName.charAt(0)}{teacher.lastName.charAt(0)}</span>
                    <div>
                      <strong>{teacher.firstName} {teacher.lastName}</strong>
                      <p>{teacher.staffCode}</p>
                      <span>{teacher.assignments} assignment{teacher.assignments === 1 ? "" : "s"}</span>
                    </div>
                  </div>
                  <div className="invitation-meta">
                    <span className={`status ${teacher.isHeadTeacher ? "status-accepted" : "status-provisioning"}`}>{teacher.isHeadTeacher ? "Head Teacher" : "Teacher"}</span>
                    <button type="button" className="button-secondary" disabled={changingAccess === teacher.membershipId} onClick={() => void setHeadTeacher(teacher.membershipId, !teacher.isHeadTeacher)}>
                      {changingAccess === teacher.membershipId ? "Saving…" : teacher.isHeadTeacher ? "Remove access" : "Make Head Teacher"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state"><strong>No active teachers yet.</strong><p>Your first teacher appears here after they complete the invitation flow.</p></div>
          )}

          <div className="assignment-section" style={{ marginTop: 22 }}>
            <div className="section-heading"><div><h2>Pending invitations</h2><p>Only invitations that still need action.</p></div><span className="count-badge">{pendingInvitations.length}</span></div>
            {pendingInvitations.length ? (
              <div className="invitation-list">
                {pendingInvitations.map((invitation) => (
                  <article className="invitation-card" key={invitation.id}>
                    <div><strong>{invitation.first_name} {invitation.last_name}</strong><p>{invitation.email}</p><span>{invitation.staff_code}</span></div>
                    <button type="button" className="button-danger" onClick={() => void revokeInvitation(invitation.id)}>Revoke</button>
                  </article>
                ))}
              </div>
            ) : <div className="empty-state">No pending invitations.</div>}
          </div>
        </section>
      </div>
    </>
  );
}
