"use client";

import { useEffect, useMemo, useState } from "react";
import { SCHOOL_CAPABILITIES, type SchoolCapability } from "@/src/lib/school-capabilities";

const CLASS_PRESETS: Record<SchoolCapability, string[]> = {
  preschool: ["Preschool 1", "Preschool 2"],
  nursery: ["Nursery 1", "Nursery 2", "Nursery 3", "Nursery 4"],
  primary: ["Primary 1", "Primary 2", "Primary 3", "Primary 4", "Primary 5", "Primary 6"],
  secondary: ["JSS 1", "JSS 2", "JSS 3", "SS 1", "SS 2", "SS 3"],
};

type ClassRow = { id: string; name: string; level: string | null };
type SubjectRow = { id: string; name: string; code: string | null; is_custom: boolean; class_ids: string[] };
type StructureData = { school: { id: string; capabilities?: string[] | null }; classes: ClassRow[]; subjects: SubjectRow[] };

type Props = { schoolId: string; initialData: StructureData };

function subjectCode(name: string) {
  const words = name.toUpperCase().replace(/[^A-Z0-9 ]+/g, " ").split(/\s+/).filter(Boolean);
  if (!words.length) return "";
  return words.length > 1 ? words.map((word) => word[0]).join("").slice(0, 6) : words[0].slice(0, 4);
}

export default function StructureSetupClient({ schoolId, initialData }: Props) {
  const [data, setData] = useState(initialData);
  const capabilities = useMemo(
    () => (initialData.school.capabilities ?? []).filter((item): item is SchoolCapability => SCHOOL_CAPABILITIES.some((capability) => capability.id === item)),
    [initialData.school.capabilities],
  );
  const [activeLevel, setActiveLevel] = useState<SchoolCapability | "">(capabilities[0] ?? "");
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [editingLevel, setEditingLevel] = useState(false);
  const [subjectName, setSubjectName] = useState("");
  const [subjectClassIds, setSubjectClassIds] = useState<string[]>([]);
  const [editingSubjectId, setEditingSubjectId] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!activeLevel) return;
    setSelectedClasses(data.classes.filter((item) => item.level === activeLevel).map((item) => item.name));
  }, [activeLevel, data.classes]);

  const currentClassGroups = useMemo(
    () => capabilities.map((level) => ({
      level,
      label: SCHOOL_CAPABILITIES.find((item) => item.id === level)?.label ?? level,
      classes: data.classes.filter((item) => item.level === level),
    })),
    [capabilities, data.classes],
  );
  const activePreset = activeLevel ? CLASS_PRESETS[activeLevel] : [];
  const previewCode = subjectCode(subjectName);
  const sortedClasses = [...data.classes].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  async function post(body: Record<string, unknown>, success: string) {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/structure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolId, ...body }),
      });
      const result = (await response.json()) as StructureData & { error?: string };
      if (!response.ok) {
        setError(result.error ?? "Unable to save school structure.");
        return false;
      }
      setData({ school: result.school, classes: result.classes, subjects: result.subjects });
      setMessage(success);
      return true;
    } catch {
      setError("We couldn't reach school structure. Try again.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function saveClassSet() {
    if (!activeLevel || !selectedClasses.length) return;
    const label = SCHOOL_CAPABILITIES.find((item) => item.id === activeLevel)?.label.toLowerCase() ?? activeLevel;
    const ok = await post({ action: "save_class_set", level: activeLevel, classes: selectedClasses }, `${selectedClasses.length} ${label} class${selectedClasses.length === 1 ? "" : "es"} saved.`);
    if (ok) setEditingLevel(false);
  }

  async function saveSubject() {
    const name = subjectName.trim();
    if (!name || !subjectClassIds.length) return;
    const ok = await post(
      { action: "save_subject", subjectId: editingSubjectId, subjectName: name, classIds: subjectClassIds },
      editingSubjectId ? "Subject updated." : "Subject added.",
    );
    if (ok) {
      setSubjectName("");
      setSubjectClassIds([]);
      setEditingSubjectId(undefined);
    }
  }

  function editSubject(subject: SubjectRow) {
    setEditingSubjectId(subject.id);
    setSubjectName(subject.name);
    setSubjectClassIds(subject.class_ids);
    setMessage("");
    setError("");
    const scroller = document.querySelector<HTMLElement>(".app-content");
    scroller?.scrollTo({ top: scroller.scrollHeight, behavior: "smooth" });
  }

  function startLevelEdit(level: SchoolCapability) {
    setActiveLevel(level);
    setSelectedClasses(data.classes.filter((item) => item.level === level).map((item) => item.name));
    setEditingLevel(true);
    setError("");
    setMessage("");
  }

  return (
    <div className="structure-setup">
      {(error || message) && (
        <div className={error ? "form-alert form-alert-error structure-feedback" : "form-alert form-alert-success structure-feedback"} role={error ? "alert" : "status"}>
          {error || message}
        </div>
      )}

      <section className="surface section-card">
        <div className="section-heading">
          <div>
            <h2>Current classes</h2>
            <p>Each school level is managed as its own class set. Change a set and save it again to reset that level.</p>
          </div>
          <span className="count-badge">{data.classes.length}</span>
        </div>

        <div className="current-class-groups">
          {currentClassGroups.map((group) => (
            <article className="class-set-card" key={group.level}>
              <div className="class-set-top">
                <div><span className="eyebrow">LEVEL</span><h3>{group.label}</h3></div>
                <button type="button" className="button-secondary" onClick={() => startLevelEdit(group.level)}>Edit set</button>
              </div>
              <div className="class-set-summary"><strong>{group.classes.length}</strong><span>class{group.classes.length === 1 ? "" : "es"} configured</span></div>
              <div className="class-chip-list">
                {group.classes.length
                  ? group.classes.map((item) => <span className="class-chip" key={item.id}>{item.name}</span>)
                  : <span className="empty-inline">No classes configured yet.</span>}
              </div>
            </article>
          ))}
        </div>

        <div className="class-set-editor">
          <div className="section-subheading">
            <strong>{editingLevel ? "Set class levels" : "Choose a level to edit"}</strong>
            {editingLevel && <button type="button" className="text-button" onClick={() => setEditingLevel(false)}>Close</button>}
          </div>
          <label className="field">
            Level / group
            <select value={activeLevel} onChange={(e) => startLevelEdit(e.target.value as SchoolCapability)}>
              <option value="">Select a school capability</option>
              {capabilities.map((level) => <option key={level} value={level}>{SCHOOL_CAPABILITIES.find((item) => item.id === level)?.label}</option>)}
            </select>
          </label>
          {editingLevel && activeLevel && (
            <>
              <div className="preset-grid">
                {activePreset.map((name) => (
                  <label className={`preset-option ${selectedClasses.includes(name) ? "is-selected" : ""}`} key={name}>
                    <input
                      type="checkbox"
                      checked={selectedClasses.includes(name)}
                      onChange={() => setSelectedClasses((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name])}
                    />
                    <span><strong>{name}</strong><small>{name}</small></span>
                  </label>
                ))}
              </div>
              <div className="class-set-editor-actions">
                <span>{selectedClasses.length} selected</span>
                <button type="button" className="btn btn-primary" onClick={() => void saveClassSet()} disabled={saving || !selectedClasses.length}>
                  {saving ? "Saving…" : `Save ${SCHOOL_CAPABILITIES.find((item) => item.id === activeLevel)?.label.toLowerCase()} set`}
                </button>
              </div>
            </>
          )}
        </div>
      </section>

      <section className="surface section-card">
        <div className="section-heading">
          <div>
            <h2>Subjects by class</h2>
            <p>A subject belongs to the classes you assign it to. This keeps curriculum selection specific to the actual teaching group.</p>
          </div>
          <span className="count-badge">{data.subjects.length}</span>
        </div>

        <div className="subject-assignment-form">
          <div className="inline-create">
            <div className="section-subheading">
              <strong>{editingSubjectId ? "Edit subject" : "Add subject"}</strong>
              {editingSubjectId && <button type="button" className="text-button" onClick={() => { setEditingSubjectId(undefined); setSubjectName(""); setSubjectClassIds([]); }}>Cancel</button>}
            </div>
            <label className="field">Subject name<input value={subjectName} onChange={(e) => setSubjectName(e.target.value)} placeholder="Mathematics" required /></label>
            <label className="field">Generated code<input value={previewCode} readOnly placeholder="Generated automatically" /></label>
            <div className="class-assignment-picker">
              <div className="section-subheading"><strong>Choose class</strong><span>{subjectClassIds.length} selected</span></div>
              <div className="subject-class-grid">
                {sortedClasses.map((item) => (
                  <label className={`preset-option ${subjectClassIds.includes(item.id) ? "is-selected" : ""}`} key={item.id}>
                    <input
                      type="checkbox"
                      checked={subjectClassIds.includes(item.id)}
                      onChange={() => setSubjectClassIds((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id])}
                    />
                    <span>
                      <strong>{item.name}</strong>
                      <small>{SCHOOL_CAPABILITIES.find((level) => level.id === item.level)?.label ?? "Class"}</small>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <button type="button" className="btn btn-primary" onClick={() => void saveSubject()} disabled={saving || !subjectName.trim() || !subjectClassIds.length}>
              {saving ? "Saving…" : editingSubjectId ? "Save subject" : "Add subject"}
            </button>
          </div>

          <div className="data-list compact-list">
            {data.subjects.length
              ? data.subjects.map((subject) => (
                  <article className="data-row subject-row" key={subject.id}>
                    <div>
                      <strong>{subject.name}</strong>
                      <p>Code · {subject.code || subjectCode(subject.name)}</p>
                      <div className="class-chip-list subject-chips">
                        {subject.class_ids.map((classId) => {
                          const item = data.classes.find((row) => row.id === classId);
                          return item ? <span className="class-chip" key={classId}>{item.name}</span> : null;
                        })}
                      </div>
                    </div>
                    <button className="button-secondary" type="button" onClick={() => editSubject(subject)}>Edit</button>
                  </article>
                ))
              : <div className="empty-state"><strong>No subjects yet.</strong><p>Add a subject and choose which classes teach it.</p></div>}
          </div>
        </div>
      </section>
    </div>
  );
}
