"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SCHOOL_CAPABILITIES } from "@/src/lib/school-capabilities";
import "./onboarding.css";

export default function OnboardingClient({ email }: { email: string }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [schoolName, setSchoolName] = useState("");
  const [schoolCode, setSchoolCode] = useState("");
  const [schoolEmail, setSchoolEmail] = useState(email);
  const [sessionName, setSessionName] = useState("2026 / 2027");
  const [sessionStartsOn, setSessionStartsOn] = useState("2026-09-01");
  const [sessionEndsOn, setSessionEndsOn] = useState("2027-07-31");
  const [currentTerm, setCurrentTerm] = useState(1);
  const [capabilities, setCapabilities] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  function toggleCapability(id: string) {
    setCapabilities((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
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
    if (step === 3 && capabilities.length === 0) {
      setError("Select at least one school capability.");
      return;
    }
    setStep((current) => Math.min(3, current + 1));
  }

  async function finish() {
    setCreating(true);
    setError("");
    try {
      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolName, schoolCode, schoolEmail, sessionName, sessionStartsOn, sessionEndsOn, currentTerm, capabilities }),
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
          <div><p className="eyebrow">SCHOOL SETUP</p><h1 id="onboarding-title">Set up your school.</h1><p className="muted">A few simple steps. Classes and subjects can be managed later from School setup.</p></div>
        </header>

        <div className="stepper" aria-label={`Step ${step} of 3`}>
          {["School", "Session", "Capabilities"].map((label, index) => <span key={label} className={index + 1 === step ? "is-current" : index + 1 < step ? "is-done" : ""}><b>{index + 1}</b>{label}</span>)}
        </div>

        {error && <div className="onboarding-error" role="alert">{error}</div>}

        {step === 1 && <div className="onboarding-step"><div className="step-copy"><span>01</span><h2>Your school</h2><p>Tell us what the school should be called inside the platform.</p></div><div className="onboarding-fields"><label>School name<input value={schoolName} onChange={(event) => setSchoolName(event.target.value)} placeholder="Your school name" autoFocus /></label><label>School code<input value={schoolCode} onChange={(event) => setSchoolCode(event.target.value.toUpperCase())} placeholder="ABC" maxLength={12} /></label><label>Email (optional)<input type="email" value={schoolEmail} onChange={(event) => setSchoolEmail(event.target.value)} placeholder="school@example.com" /></label></div></div>}

        {step === 2 && <div className="onboarding-step"><div className="step-copy"><span>02</span><h2>Academic session</h2><p>Set the school year and choose which term is active now.</p></div><div className="onboarding-fields"><label>Session name<input value={sessionName} onChange={(event) => setSessionName(event.target.value)} /></label><div className="onboarding-grid"><label>Starts<input type="date" value={sessionStartsOn} onChange={(event) => setSessionStartsOn(event.target.value)} /></label><label>Ends<input type="date" value={sessionEndsOn} onChange={(event) => setSessionEndsOn(event.target.value)} /></label></div><fieldset><legend>Current term</legend><div className="choice-row">{[1, 2, 3].map((number) => <button type="button" key={number} className={currentTerm === number ? "choice is-selected" : "choice"} onClick={() => setCurrentTerm(number)}>{number === 1 ? "First" : number === 2 ? "Second" : "Third"} Term</button>)}</div></fieldset></div></div>}

        {step === 3 && <div className="onboarding-step"><div className="step-copy"><span>03</span><h2>School capabilities</h2><p>Select the parts of education your school provides. You can create the actual classes later in School setup.</p></div><div className="onboarding-fields"><div className="subject-grid">{SCHOOL_CAPABILITIES.map((item) => <label className={`subject-option ${capabilities.includes(item.id) ? "is-selected" : ""}`} key={item.id}><input type="checkbox" checked={capabilities.includes(item.id)} onChange={() => toggleCapability(item.id)} /><span><strong>{item.label}</strong><small>{item.description}</small></span></label>)}</div><div className="invite-email"><span>Next</span><strong>After setup, add classes and subjects from the school dashboard.</strong></div></div></div>}

        <footer className="onboarding-actions">{step > 1 ? <button className="btn btn-secondary" type="button" onClick={() => setStep((current) => current - 1)}>Back</button> : <span />}{step < 3 ? <button className="btn btn-primary" type="button" onClick={next}>Continue</button> : <button className="btn btn-primary" type="button" onClick={() => void finish()} disabled={creating || capabilities.length === 0}>{creating ? "Setting up…" : "Finish setup"}</button>}</footer>
      </section>
    </main>
  );
}
