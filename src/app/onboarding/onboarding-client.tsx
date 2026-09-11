"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SUBJECT_CATALOG } from "@/src/lib/subject-catalog";
import { createClient } from "@/src/lib/supabase/client";
import "./onboarding.css";

type ClassRow = { name: string; level: string };
type SubjectRow = { name: string; code: string; isCustom?: boolean };

const DEFAULT_CLASSES: ClassRow[] = [
  { name: "Primary 5", level: "Primary" },
  { name: "Primary 6", level: "Primary" },
];

const DEFAULT_SUBJECTS: SubjectRow[] = [
  ...SUBJECT_CATALOG.filter((subject) => ["English Language", "Mathematics", "Basic Science", "Social Studies", "Civic Education", "Computer Studies"].includes(subject.name)).map((subject) => ({ name: subject.name, code: subject.code })),
];

export default function OnboardingClient({ displayName, email }: { displayName: string; email: string }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [schoolName, setSchoolName] = useState("");
  const [schoolCode, setSchoolCode] = useState("");
  const [schoolEmail, setSchoolEmail] = useState(email);
  const [sessionName, setSessionName] = useState("2026 / 2027");
  const [sessionStartsOn, setSessionStartsOn] = useState("2026-09-01");
  const [sessionEndsOn, setSessionEndsOn] = useState("2027-07-31");
  const [currentTerm, setCurrentTerm] = useState(1);
  const [classes, setClasses] = useState<ClassRow[]>(DEFAULT_CLASSES);
  const [newClassName, setNewClassName] = useState("");
  const [newClassLevel, setNewClassLevel] = useState("Primary");
  const [subjects, setSubjects] = useState<SubjectRow[]>(DEFAULT_SUBJECTS);
  const [newSubject, setNewSubject] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const selectedCatalogSubjects = useMemo(() => new Set(subjects.map((subject) => subject.name.toLowerCase())), [subjects]);
  const recommendedSubjects = useMemo(() => SUBJECT_CATALOG.filter((subject) => {
    if (classes.length === 0) return true;
    return classes.some((item) => subject.sections.includes(item.level === "Primary" ? "Primary" : item.level.includes("JSS") ? "JSS" : item.level.includes("SSS") ? "SSS" : "Primary"));
  }), [classes]);

  function toggleSubject(name: string, code: string) {
    setSubjects((current) => current.some((item) => item.name === name) ? current.filter((item) => item.name !== name) : [...current, { name, code }]);
  }

  function addClass() {
    const name = newClassName.trim();
    if (!name || classes.some((item) => item.name.toLowerCase() === name.toLowerCase())) return;
    setClasses((current) => [...current, { name, level: newClassLevel }]);
    setNewClassName("");
  }

  function addCustomSubject() {
    const name = newSubject.trim();
    if (!name || subjects.some((item) => item.name.toLowerCase() === name.toLowerCase())) return;
    setSubjects((current) => [...current, { name, code: "", isCustom: true }]);
    setNewSubject("");
  }

  function next() {
    setError("");
    if (step === 1 && (!schoolName.trim() || !schoolCode.trim())) {
      setError("Enter the school name and a short school code.");
      return;
    }
    if (step === 2 && (!sessionName.trim() || !sessionStartsOn || !sessionEndsOn || sessionEndsOn < sessionStartsOn)) {
      setError("Check the academic session details.");
      return;
    }
    setStep((current) => Math.min(4, current + 1));
  }

  async function finish() {
    setCreating(true);
    setError("");
    try {
      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolName, schoolCode, schoolEmail, sessionName, sessionStartsOn, sessionEndsOn, currentTerm, classes, subjects }),
      });
      const result = (await response.json()) as { error?: string; ok?: boolean };
      if (!response.ok) {
        setError(result.error ?? "We could not finish school setup.");
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError("We couldn't reach the onboarding service. Try again.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="onboarding-shell">
      <section className="onboarding-card" aria-labelledby="onboarding-title">
        <header className="onboarding-header">
          <div className="brand-mark">SL</div>
          <div><p className="eyebrow">SCHOOL SETUP</p><h1 id="onboarding-title">Set up your school.</h1><p className="muted">A few simple steps. You can change everything later from School setup.</p></div>
        </header>

        <div className="stepper" aria-label={`Step ${step} of 4`}>
          {["School", "Session", "Classes", "Subjects"].map((label, index) => <span key={label} className={index + 1 === step ? "is-current" : index + 1 < step ? "is-done" : ""}><b>{index + 1}</b>{label}</span>)}
        </div>

        {error && <div className="onboarding-error" role="alert">{error}</div>}

        {step === 1 && <div className="onboarding-step"><div className="step-copy"><span>01</span><h2>Your school</h2><p>Tell us what teachers will see when they sign in.</p></div><div className="onboarding-fields"><label>School name<input value={schoolName} onChange={(event) => setSchoolName(event.target.value)} placeholder="Future Speakers International School" autoFocus /></label><label>School code<input value={schoolCode} onChange={(event) => setSchoolCode(event.target.value.toUpperCase())} placeholder="FSIS" maxLength={12} /></label><label>Email (optional)<input type="email" value={schoolEmail} onChange={(event) => setSchoolEmail(event.target.value)} placeholder="school@example.com" /></label></div></div>}

        {step === 2 && <div className="onboarding-step"><div className="step-copy"><span>02</span><h2>Academic session</h2><p>We will create the three terms automatically. Pick which term is active now.</p></div><div className="onboarding-fields"><label>Session name<input value={sessionName} onChange={(event) => setSessionName(event.target.value)} /></label><div className="onboarding-grid"><label>Starts<input type="date" value={sessionStartsOn} onChange={(event) => setSessionStartsOn(event.target.value)} /></label><label>Ends<input type="date" value={sessionEndsOn} onChange={(event) => setSessionEndsOn(event.target.value)} /></label></div><fieldset><legend>Current term</legend><div className="choice-row">{[1, 2, 3].map((number) => <button type="button" key={number} className={currentTerm === number ? "choice is-selected" : "choice"} onClick={() => setCurrentTerm(number)}>{number === 1 ? "First" : number === 2 ? "Second" : "Third"} Term</button>)}</div></fieldset></div></div>}

        {step === 3 && <div className="onboarding-step"><div className="step-copy"><span>03</span><h2>Your classes</h2><p>Use the section to group classes. You can add more later.</p></div><div className="onboarding-fields"><div className="class-list">{classes.map((item) => <div className="mini-row" key={item.name}><strong>{item.name}</strong><span>{item.level}</span><button type="button" aria-label={`Remove ${item.name}`} onClick={() => setClasses((current) => current.filter((row) => row.name !== item.name))}>×</button></div>)}</div><div className="onboarding-grid"><label>Class name<input value={newClassName} onChange={(event) => setNewClassName(event.target.value)} placeholder="JSS 1" /></label><label>Section<select value={newClassLevel} onChange={(event) => setNewClassLevel(event.target.value)}><option>Primary</option><option>JSS</option><option>SSS</option><option>Other</option></select></label></div><button type="button" className="btn btn-secondary full" onClick={addClass}>Add class</button></div></div>}

        {step === 4 && <div className="onboarding-step"><div className="step-copy"><span>04</span><h2>Choose your subjects</h2><p>System subjects are ready to tick. Custom subjects stay with your school.</p></div><div className="onboarding-fields"><div className="subject-picker"><div className="subject-picker-heading"><strong>System subjects</strong><span>{subjects.filter((item) => !item.isCustom).length} selected</span></div><div className="subject-grid">{recommendedSubjects.map((subject) => <label className={`subject-option ${selectedCatalogSubjects.has(subject.name.toLowerCase()) ? "is-selected" : ""}`} key={subject.name}><input type="checkbox" checked={selectedCatalogSubjects.has(subject.name.toLowerCase())} onChange={() => toggleSubject(subject.name, subject.code)} /><span><strong>{subject.name}</strong><small>{subject.code}</small></span></label>)}</div></div><div className="custom-subject"><strong>Custom subject</strong><div className="custom-row"><input value={newSubject} onChange={(event) => setNewSubject(event.target.value)} placeholder="e.g. French" /><button type="button" className="btn btn-secondary" onClick={addCustomSubject}>Add</button></div>{subjects.filter((item) => item.isCustom).map((subject) => <div className="mini-row" key={subject.name}><strong>{subject.name}</strong><span>Custom</span><button type="button" aria-label={`Remove ${subject.name}`} onClick={() => setSubjects((current) => current.filter((row) => row.name !== subject.name))}>×</button></div>)}</div></div></div>}

        <footer className="onboarding-actions">{step > 1 ? <button className="btn btn-secondary" type="button" onClick={() => setStep((current) => current - 1)}>Back</button> : <span />}{step < 4 ? <button className="btn btn-primary" type="button" onClick={next}>Continue</button> : <button className="btn btn-primary" type="button" onClick={() => void finish()} disabled={creating}>{creating ? "Setting up…" : "Finish setup"}</button>}</footer>
      </section>
    </main>
  );
}
