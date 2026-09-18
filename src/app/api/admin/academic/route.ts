import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/src/lib/supabase/server";

const ADMIN_ROLES = ["school_admin", "academic_coordinator", "platform_admin"] as const;
const ALLOWED_CAPABILITIES = new Set(["preschool", "nursery", "primary", "secondary"]);
type Action = "update_school_capabilities" | "create_session" | "update_session" | "create_term" | "update_term" | "create_classes" | "create_class" | "update_class" | "delete_class" | "create_subject" | "update_subject" | "delete_subject";

type ClassInput = { name?: string; level?: string };

function jsonError(message: string, status = 400) { return NextResponse.json({ error: message }, { status }); }

function generateSubjectCode(name: string) {
  const words = name.toUpperCase().replace(/[^A-Z0-9 ]+/g, " ").split(/\s+/).filter(Boolean);
  if (!words.length) return "SUB";
  if (words.length > 1) return words.map((word) => word[0]).join("").slice(0, 6);
  return words[0].slice(0, 4);
}

async function uniqueSubjectCode(supabase: Awaited<ReturnType<typeof createClient>>, schoolId: string, name: string, subjectId?: string) {
  const base = generateSubjectCode(name);
  for (let suffix = 0; suffix < 100; suffix += 1) {
    const code = suffix === 0 ? base : `${base}${suffix + 1}`;
    let query = supabase.from("subjects").select("id").eq("school_id", schoolId).eq("code", code).limit(1);
    if (subjectId) query = query.neq("id", subjectId);
    const { data } = await query.maybeSingle();
    if (!data) return code;
  }
  return `${base}${Date.now().toString().slice(-4)}`;
}

async function getAdminContext(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return null;
  const { data: memberships, error } = await supabase.from("school_memberships").select("school_id, role").eq("user_id", auth.user.id).eq("is_active", true).in("role", [...ADMIN_ROLES]);
  if (error || !memberships?.length) return null;
  const schoolIds = [...new Set(memberships.map((membership) => membership.school_id))];
  const { data: schools } = await supabase.from("schools").select("id, name, code, capabilities").in("id", schoolIds).order("name");
  return { user: auth.user, memberships, schools: schools ?? [] };
}

function canManageSchool(context: Awaited<ReturnType<typeof getAdminContext>>, schoolId: string) { return Boolean(context?.memberships.some((membership) => membership.school_id === schoolId)); }

async function loadAcademicData(supabase: Awaited<ReturnType<typeof createClient>>, schoolId: string) {
  const [{ data: sessions }, { data: classes }, { data: subjects }] = await Promise.all([
    supabase.from("academic_sessions").select("id, name, starts_on, ends_on, is_current").eq("school_id", schoolId).order("starts_on", { ascending: false }),
    supabase.from("classes").select("id, name, level").eq("school_id", schoolId).order("name"),
    supabase.from("subjects").select("id, name, code").eq("school_id", schoolId).order("name"),
  ]);
  const sessionIds = (sessions ?? []).map((session) => session.id);
  const { data: terms } = sessionIds.length
    ? await supabase.from("terms").select("id, academic_session_id, name, term_number, starts_on, ends_on, is_current").in("academic_session_id", sessionIds).order("term_number")
    : { data: [] as { id: string; academic_session_id: string; name: string; term_number: number; starts_on: string; ends_on: string; is_current: boolean }[] };
  const school = (await supabase.from("schools").select("id, name, code, capabilities").eq("id", schoolId).maybeSingle()).data;
  return { school, sessions: sessions ?? [], terms: terms ?? [], classes: classes ?? [], subjects: subjects ?? [] };
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const context = await getAdminContext(supabase);
  if (!context) return jsonError("You do not have academic setup access.", 403);
  const requestedSchoolId = request.nextUrl.searchParams.get("schoolId");
  const schoolId = requestedSchoolId ?? context.schools[0]?.id;
  if (!schoolId || !canManageSchool(context, schoolId)) return jsonError("You do not have access to that school.", 403);
  return NextResponse.json({ schools: context.schools, ...(await loadAcademicData(supabase, schoolId)) });
}

async function clearOtherCurrentSessions(supabase: Awaited<ReturnType<typeof createClient>>, schoolId: string, exceptId?: string) {
  let query = supabase.from("academic_sessions").update({ is_current: false, updated_at: new Date().toISOString() }).eq("school_id", schoolId).eq("is_current", true);
  if (exceptId) query = query.neq("id", exceptId); return query;
}
async function clearOtherCurrentTerms(supabase: Awaited<ReturnType<typeof createClient>>, sessionId: string, exceptId?: string) {
  let query = supabase.from("terms").update({ is_current: false, updated_at: new Date().toISOString() }).eq("academic_session_id", sessionId).eq("is_current", true);
  if (exceptId) query = query.neq("id", exceptId); return query;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const context = await getAdminContext(supabase);
  if (!context) return jsonError("You do not have academic setup access.", 403);
  try {
    const body = (await request.json()) as {
      action?: Action;
      schoolId?: string;
      capabilities?: string[];
      sessionId?: string;
      termId?: string;
      classId?: string;
      subjectId?: string;
      name?: string;
      code?: string;
      level?: string;
      classes?: ClassInput[];
      startsOn?: string;
      endsOn?: string;
      termNumber?: number;
      isCurrent?: boolean;
    };
    const { action, schoolId } = body;
    if (!action || !schoolId) return jsonError("Action and school are required.");
    if (!canManageSchool(context, schoolId)) return jsonError("You do not have access to that school.", 403);

    if (action === "update_school_capabilities") {
      const capabilities = [...new Set((body.capabilities ?? []).map((item) => item.trim().toLowerCase()).filter((item) => ALLOWED_CAPABILITIES.has(item)))];
      if (!capabilities.length) return jsonError("Select at least one school capability.");
      const { error } = await supabase.from("schools").update({ capabilities, updated_at: new Date().toISOString() }).eq("id", schoolId);
      if (error) return jsonError("Unable to update school capabilities.", 409);
      return NextResponse.json({ ok: true, ...(await loadAcademicData(supabase, schoolId)) });
    }

    if (action === "create_session" || action === "update_session") {
      if (!body.name?.trim() || !body.startsOn || !body.endsOn) return jsonError("Session name and dates are required.");
      if (body.endsOn < body.startsOn) return jsonError("Session end date cannot be before its start date.");
      if (action === "update_session" && !body.sessionId) return jsonError("Session is required.");
      if (body.isCurrent) { const { error } = await clearOtherCurrentSessions(supabase, schoolId, body.sessionId); if (error) return jsonError("Unable to update the current session.", 409); }
      const payload = { school_id: schoolId, name: body.name.trim(), starts_on: body.startsOn, ends_on: body.endsOn, is_current: Boolean(body.isCurrent), updated_at: new Date().toISOString() };
      const query = action === "create_session" ? supabase.from("academic_sessions").insert(payload) : supabase.from("academic_sessions").update(payload).eq("id", body.sessionId ?? "").eq("school_id", schoolId);
      const { error } = await query; if (error) return jsonError(error.code === "23505" ? "That session already exists or is already marked current." : "Unable to save academic session.", 409);
      return NextResponse.json({ ok: true, ...(await loadAcademicData(supabase, schoolId)) });
    }

    if (action === "create_term" || action === "update_term") {
      if (!body.sessionId || !body.name?.trim() || !body.startsOn || !body.endsOn || !body.termNumber) return jsonError("Academic session, term name, number and dates are required.");
      if (![1, 2, 3].includes(body.termNumber)) return jsonError("Term number must be 1, 2 or 3.");
      if (body.endsOn < body.startsOn) return jsonError("Term end date cannot be before its start date.");
      if (action === "update_term" && !body.termId) return jsonError("Term is required.");
      const { data: session } = await supabase.from("academic_sessions").select("id").eq("id", body.sessionId).eq("school_id", schoolId).maybeSingle();
      if (!session) return jsonError("Academic session does not belong to this school.", 400);
      if (body.isCurrent) { const { error } = await clearOtherCurrentTerms(supabase, body.sessionId, body.termId); if (error) return jsonError("Unable to update the current term.", 409); }
      const payload = { academic_session_id: body.sessionId, name: body.name.trim(), term_number: body.termNumber, starts_on: body.startsOn, ends_on: body.endsOn, is_current: Boolean(body.isCurrent), updated_at: new Date().toISOString() };
      const query = action === "create_term" ? supabase.from("terms").insert(payload) : supabase.from("terms").update(payload).eq("id", body.termId ?? "");
      const { error } = await query; if (error) return jsonError(error.code === "23505" ? "That term already exists or is already marked current." : "Unable to save term.", 409);
      return NextResponse.json({ ok: true, ...(await loadAcademicData(supabase, schoolId)) });
    }

    if (action === "create_classes") {
      const incoming = Array.isArray(body.classes) ? body.classes : [];
      if (!incoming.length) return jsonError("Choose at least one class.");
      const { data: school } = await supabase.from("schools").select("capabilities").eq("id", schoolId).maybeSingle();
      const capabilities = new Set((school?.capabilities ?? []).filter((item: string) => ALLOWED_CAPABILITIES.has(item)));
      const normalized = incoming.map((item) => ({ name: item.name?.trim() ?? "", level: item.level?.trim().toLowerCase() ?? "" })).filter((item) => item.name);
      if (!normalized.length) return jsonError("Enter at least one class.");
      if (normalized.some((item) => !capabilities.has(item.level))) return jsonError("One or more class levels are not enabled for this school.", 400);
      const unique = [...new Map(normalized.map((item) => [`${item.name.toLowerCase()}::${item.level}`, item])).values()];
      const { data: existing } = await supabase.from("classes").select("name, level").eq("school_id", schoolId);
      const existingKeys = new Set((existing ?? []).map((item) => `${item.name.toLowerCase()}::${(item.level ?? "").toLowerCase()}`));
      const payload = unique.filter((item) => !existingKeys.has(`${item.name.toLowerCase()}::${item.level}`)).map((item) => ({ school_id: schoolId, name: item.name, level: item.level, updated_at: new Date().toISOString() }));
      if (payload.length) {
        const { error } = await supabase.from("classes").insert(payload);
        if (error) return jsonError(error.code === "23505" ? "One or more selected classes already exist." : "Unable to add classes.", 409);
      }
      return NextResponse.json({ ok: true, ...(await loadAcademicData(supabase, schoolId)) });
    }

    if (action === "create_class" || action === "update_class") {
      if (!body.name?.trim()) return jsonError("Class name is required.");
      if (action === "update_class" && !body.classId) return jsonError("Class is required.");
      if (body.level && !ALLOWED_CAPABILITIES.has(body.level.trim().toLowerCase())) return jsonError("Invalid class level.");
      const { data: school } = await supabase.from("schools").select("capabilities").eq("id", schoolId).maybeSingle();
      if (body.level && !new Set(school?.capabilities ?? []).has(body.level.trim().toLowerCase())) return jsonError("This school capability is not enabled.", 400);
      const payload = { school_id: schoolId, name: body.name.trim(), level: body.level?.trim().toLowerCase() || null, updated_at: new Date().toISOString() };
      const query = action === "create_class" ? supabase.from("classes").insert(payload) : supabase.from("classes").update(payload).eq("id", body.classId ?? "").eq("school_id", schoolId);
      const { error } = await query; if (error) return jsonError(error.code === "23505" ? "That class already exists." : "Unable to save class.", 409);
      return NextResponse.json({ ok: true, ...(await loadAcademicData(supabase, schoolId)) });
    }

    if (action === "delete_class" || action === "delete_subject") return jsonError("Classes and subjects cannot be deleted once created. Edit the record instead so historical teaching data remains safe.", 409);

    if (action === "create_subject" || action === "update_subject") {
      if (!body.name?.trim()) return jsonError("Subject name is required.");
      if (action === "update_subject" && !body.subjectId) return jsonError("Subject is required.");
      const code = await uniqueSubjectCode(supabase, schoolId, body.name.trim(), body.subjectId);
      const payload = { school_id: schoolId, name: body.name.trim(), code, updated_at: new Date().toISOString() };
      const query = action === "create_subject" ? supabase.from("subjects").insert(payload) : supabase.from("subjects").update(payload).eq("id", body.subjectId ?? "").eq("school_id", schoolId);
      const { error } = await query; if (error) return jsonError(error.code === "23505" ? "That subject is already in use." : "Unable to save subject.", 409);
      return NextResponse.json({ ok: true, ...(await loadAcademicData(supabase, schoolId)) });
    }

    return jsonError("Unsupported academic setup action.");
  } catch (error) { console.error("Academic setup POST failed", error); return jsonError("Unable to update academic setup.", 500); }
}
