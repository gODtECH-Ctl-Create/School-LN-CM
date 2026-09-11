import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/src/lib/supabase/server";
import { createAdminClient } from "@/src/lib/supabase/admin";
import { SUBJECT_CATALOG, normalizeSection } from "@/src/lib/subject-catalog";

const DEFAULT_TERMS = [
  { number: 1, name: "First Term" },
  { number: 2, name: "Second Term" },
  { number: 3, name: "Third Term" },
] as const;

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function makeTermDates(start: string, end: string, termNumber: number) {
  const startDate = new Date(`${start}T00:00:00Z`);
  const endDate = new Date(`${end}T00:00:00Z`);
  const total = Math.max(1, endDate.getTime() - startDate.getTime());
  const chunk = Math.floor(total / 3);
  const termStart = new Date(startDate.getTime() + chunk * (termNumber - 1));
  const termEnd = termNumber === 3 ? endDate : new Date(startDate.getTime() + chunk * termNumber - 24 * 60 * 60 * 1000);
  return {
    startsOn: termStart.toISOString().slice(0, 10),
    endsOn: termEnd.toISOString().slice(0, 10),
  };
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return jsonError("Sign in before setting up a school.", 401);

  try {
    const body = (await request.json()) as {
      schoolName?: string;
      schoolCode?: string;
      schoolEmail?: string;
      sessionName?: string;
      sessionStartsOn?: string;
      sessionEndsOn?: string;
      currentTerm?: number;
      classes?: { name: string; level: string }[];
      subjects?: { name: string; code?: string; isCustom?: boolean }[];
    };

    const schoolName = body.schoolName?.trim();
    const schoolCode = body.schoolCode?.trim().toUpperCase();
    const sessionName = body.sessionName?.trim();
    const sessionStartsOn = body.sessionStartsOn;
    const sessionEndsOn = body.sessionEndsOn;
    const currentTerm = body.currentTerm ?? 1;
    const classes = Array.isArray(body.classes) ? body.classes : [];
    const requestedSubjects = Array.isArray(body.subjects) ? body.subjects : [];

    if (!schoolName || schoolName.length < 2) return jsonError("Enter the school name.");
    if (!schoolCode || !/^[A-Z0-9]{2,12}$/.test(schoolCode)) return jsonError("Use a school code with 2–12 letters or numbers.");
    if (!sessionName || !sessionStartsOn || !sessionEndsOn) return jsonError("Academic session details are required.");
    if (sessionEndsOn < sessionStartsOn) return jsonError("Academic session end date cannot be before its start date.");
    if (![1, 2, 3].includes(currentTerm)) return jsonError("Current term must be First, Second or Third Term.");

    const admin = createAdminClient();
    const { data: existingSchool } = await admin.from("schools").select("id").eq("code", schoolCode).maybeSingle();
    if (existingSchool) return jsonError("That school code is already in use. Choose another one.", 409);

    const { data: school, error: schoolError } = await admin
      .from("schools")
      .insert({ name: schoolName, code: schoolCode, email: body.schoolEmail?.trim().toLowerCase() || null, timezone: "Africa/Lagos", currency: "NGN", subscription_status: "trial" })
      .select("id, name, code")
      .single();
    if (schoolError || !school) return jsonError("Unable to create the school.", 500);

    const { error: profileError } = await admin.from("profiles").upsert({
      id: auth.user.id,
      display_name: auth.user.user_metadata?.full_name ?? auth.user.email ?? "School administrator",
      updated_at: new Date().toISOString(),
    });
    if (profileError) throw profileError;

    const { data: membership, error: membershipError } = await admin
      .from("school_memberships")
      .insert({ school_id: school.id, user_id: auth.user.id, role: "school_admin", is_active: true })
      .select("id")
      .single();
    if (membershipError || !membership) throw membershipError ?? new Error("Unable to create school membership.");

    const { data: session, error: sessionError } = await admin
      .from("academic_sessions")
      .insert({ school_id: school.id, name: sessionName, starts_on: sessionStartsOn, ends_on: sessionEndsOn, is_current: true })
      .select("id")
      .single();
    if (sessionError || !session) throw sessionError ?? new Error("Unable to create academic session.");

    const terms = DEFAULT_TERMS.map((term) => {
      const dates = makeTermDates(sessionStartsOn, sessionEndsOn, term.number);
      return { academic_session_id: session.id, name: term.name, term_number: term.number, starts_on: dates.startsOn, ends_on: dates.endsOn, is_current: term.number === currentTerm };
    });
    const { error: termsError } = await admin.from("terms").insert(terms);
    if (termsError) throw termsError;

    const normalizedClasses = classes
      .map((item) => ({ name: item.name?.trim(), level: item.level?.trim() || null }))
      .filter((item) => item.name);
    if (normalizedClasses.length) {
      const { error } = await admin.from("classes").insert(normalizedClasses.map((item) => ({ school_id: school.id, ...item })));
      if (error) throw error;
    }

    const selectedNames = new Set(requestedSubjects.map((item) => item.name?.trim().toLowerCase()).filter(Boolean));
    const sections = new Set(normalizedClasses.map((item) => normalizeSection(item.level)).filter(Boolean));
    const systemSubjects = SUBJECT_CATALOG.filter((subject) => sections.size === 0 || [...sections].some((section) => subject.sections.includes(section))).map((subject) => ({ school_id: school.id, name: subject.name, code: subject.code, is_custom: false }));
    const customSubjects = requestedSubjects
      .filter((item) => item.isCustom === true)
      .map((item) => ({ school_id: school.id, name: item.name?.trim() ?? "", code: item.code?.trim().toUpperCase() || null, is_custom: true }))
      .filter((item) => item.name && !selectedNames.has(item.name.toLowerCase()) === false);
    const subjects = [...new Map([...systemSubjects, ...customSubjects].filter((item) => item.name).map((item) => [item.name.toLowerCase(), item])).values()];
    if (subjects.length) {
      const { error } = await admin.from("subjects").insert(subjects);
      if (error) throw error;
    }

    return NextResponse.json({ ok: true, school, membershipId: membership.id });
  } catch (error) {
    console.error("Onboarding failed", error);
    return jsonError("We could not finish school setup. Please try again.", 500);
  }
}
