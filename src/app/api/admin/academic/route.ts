import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/src/lib/supabase/server";

const ADMIN_ROLES = ["school_admin", "academic_coordinator", "platform_admin"] as const;

type Action = "create_session" | "update_session" | "create_term" | "update_term" | "create_class" | "update_class" | "delete_class" | "create_subject" | "update_subject" | "delete_subject";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function getAdminContext(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return null;

  const { data: memberships, error } = await supabase
    .from("school_memberships")
    .select("school_id, role")
    .eq("user_id", auth.user.id)
    .eq("is_active", true)
    .in("role", [...ADMIN_ROLES]);

  if (error || !memberships?.length) return null;

  const schoolIds = [...new Set(memberships.map((membership) => membership.school_id))];
  const { data: schools } = await supabase
    .from("schools")
    .select("id, name, code")
    .in("id", schoolIds)
    .order("name");

  return { user: auth.user, memberships, schools: schools ?? [] };
}

function canManageSchool(
  context: Awaited<ReturnType<typeof getAdminContext>>,
  schoolId: string,
) {
  return Boolean(context?.memberships.some((membership) => membership.school_id === schoolId));
}

async function loadAcademicData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  schoolId: string,
) {
  const [{ data: sessions }, { data: classes }, { data: subjects }] = await Promise.all([
    supabase
      .from("academic_sessions")
      .select("id, name, starts_on, ends_on, is_current")
      .eq("school_id", schoolId)
      .order("starts_on", { ascending: false }),
    supabase
      .from("classes")
      .select("id, name, level")
      .eq("school_id", schoolId)
      .order("name"),
    supabase
      .from("subjects")
      .select("id, name, code")
      .eq("school_id", schoolId)
      .order("name"),
  ]);

  const sessionIds = (sessions ?? []).map((session) => session.id);
  const { data: terms } = sessionIds.length
    ? await supabase
        .from("terms")
        .select("id, academic_session_id, name, term_number, starts_on, ends_on, is_current")
        .in("academic_session_id", sessionIds)
        .order("term_number")
    : { data: [] as { id: string; academic_session_id: string; name: string; term_number: number; starts_on: string; ends_on: string; is_current: boolean }[] };

  return {
    sessions: sessions ?? [],
    terms: terms ?? [],
    classes: classes ?? [],
    subjects: subjects ?? [],
  };
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const context = await getAdminContext(supabase);
  if (!context) return jsonError("You do not have academic setup access.", 403);

  const requestedSchoolId = request.nextUrl.searchParams.get("schoolId");
  const schoolId = requestedSchoolId ?? context.schools[0]?.id;
  if (!schoolId || !canManageSchool(context, schoolId)) {
    return jsonError("You do not have access to that school.", 403);
  }

  const data = await loadAcademicData(supabase, schoolId);
  const school = context.schools.find((item) => item.id === schoolId);
  return NextResponse.json({ schools: context.schools, school, ...data });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const context = await getAdminContext(supabase);
  if (!context) return jsonError("You do not have academic setup access.", 403);

  try {
    const body = (await request.json()) as {
      action?: Action;
      schoolId?: string;
      sessionId?: string;
      termId?: string;
      classId?: string;
      subjectId?: string;
      name?: string;
      code?: string;
      level?: string;
      startsOn?: string;
      endsOn?: string;
      termNumber?: number;
      isCurrent?: boolean;
    };

    const action = body.action;
    const schoolId = body.schoolId;
    if (!action || !schoolId) return jsonError("Action and school are required.");
    if (!canManageSchool(context, schoolId)) return jsonError("You do not have access to that school.", 403);

    if (action === "create_session" || action === "update_session") {
      const name = body.name?.trim();
      const startsOn = body.startsOn;
      const endsOn = body.endsOn;
      if (!name || !startsOn || !endsOn) return jsonError("Session name and dates are required.");
      if (endsOn < startsOn) return jsonError("Session end date cannot be before its start date.");
      if (action === "create_session") {
        const { error } = await supabase.from("academic_sessions").insert({
          school_id: schoolId,
          name,
          starts_on: startsOn,
          ends_on: endsOn,
          is_current: Boolean(body.isCurrent),
        });
        if (error) return jsonError(error.code === "23505" ? "That session already exists or is already marked current." : "Unable to create academic session.", 409);
      } else {
        if (!body.sessionId) return jsonError("Session is required.");
        if (body.isCurrent) {
          const { error: clearError } = await supabase
            .from("academic_sessions")
            .update({ is_current: false })
            .eq("school_id", schoolId)
            .eq("is_current", true)
            .neq("id", body.sessionId);
          if (clearError) return jsonError("Unable to update current session.", 409);
        }
        const { error } = await supabase
          .from("academic_sessions")
          .update({ name, starts_on: startsOn, ends_on: endsOn, is_current: Boolean(body.isCurrent), updated_at: new Date().toISOString() })
          .eq("id", body.sessionId)
          .eq("school_id", schoolId);
        if (error) return jsonError(error.code === "23505" ? "That session already exists or is already marked current." : "Unable to update academic session.", 409);
      }
      return NextResponse.json({ ok: true, ...(await loadAcademicData(supabase, schoolId)) });
    }

    if (action === "create_term" || action === "update_term") {
      if (!body.sessionId || !body.name?.trim() || !body.startsOn || !body.endsOn || !body.termNumber) {
        return jsonError("Academic session, term name, number and dates are required.");
      }
      if (![1, 2, 3].includes(body.termNumber)) return jsonError("Term number must be 1, 2 or 3.");
      if (body.endsOn < body.startsOn) return jsonError("Term end date cannot be before its start date.");
      const { data: session } = await supabase
        .from("academic_sessions")
        .select("id")
        .eq("id", body.sessionId)
        .eq("school_id", schoolId)
        .maybeSingle();
      if (!session) return jsonError("Academic session does not belong to this school.", 400);

      if (action === "create_term") {
        const { error } = await supabase.from("terms").insert({
          academic_session_id: body.sessionId,
          name: body.name.trim(),
          term_number: body.termNumber,
          starts_on: body.startsOn,
          ends_on: body.endsOn,
          is_current: Boolean(body.isCurrent),
        });
        if (error) return jsonError(error.code === "23505" ? "That term already exists or is already marked current." : "Unable to create term.", 409);
      } else {
        if (!body.termId) return jsonError("Term is required.");
        if (body.isCurrent) {
          const { error: clearError } = await supabase
            .from("terms")
            .update({ is_current: false })
            .eq("academic_session_id", body.sessionId)
            .eq("is_current", true)
            .neq("id", body.termId);
          if (clearError) return jsonError("Unable to update current term.", 409);
        }
        const { error } = await supabase
          .from("terms")
          .update({ name: body.name.trim(), term_number: body.termNumber, starts_on: body.startsOn, ends_on: body.endsOn, is_current: Boolean(body.isCurrent), updated_at: new Date().toISOString() })
          .eq("id", body.termId);
        if (error) return jsonError(error.code === "23505" ? "That term already exists or is already marked current." : "Unable to update term.", 409);
      }
      return NextResponse.json({ ok: true, ...(await loadAcademicData(supabase, schoolId)) });
    }

    if (["create_class", "update_class", "delete_class"].includes(action)) {
      if (action === "delete_class") {
        if (!body.classId) return jsonError("Class is required.");
        const { error } = await supabase.from("classes").delete().eq("id", body.classId).eq("school_id", schoolId);
        if (error) return jsonError("Unable to remove class. It may already be referenced by teaching assignments.", 409);
      } else {
        if (!body.name?.trim()) return jsonError("Class name is required.");
        if (action === "create_class") {
          const { error } = await supabase.from("classes").insert({ school_id: schoolId, name: body.name.trim(), level: body.level?.trim() || null });
          if (error) return jsonError(error.code === "23505" ? "That class already exists." : "Unable to create class.", 409);
        } else {
          if (!body.classId) return jsonError("Class is required.");
          const { error } = await supabase.from("classes").update({ name: body.name.trim(), level: body.level?.trim() || null, updated_at: new Date().toISOString() }).eq("id", body.classId).eq("school_id", schoolId);
          if (error) return jsonError(error.code === "23505" ? "That class name is already in use." : "Unable to update class.", 409);
        }
      }
      return NextResponse.json({ ok: true, ...(await loadAcademicData(supabase, schoolId)) });
    }

    if (["create_subject", "update_subject", "delete_subject"].includes(action)) {
      if (action === "delete_subject") {
        if (!body.subjectId) return jsonError("Subject is required.");
        const { error } = await supabase.from("subjects").delete().eq("id", body.subjectId).eq("school_id", schoolId);
        if (error) return jsonError("Unable to remove subject. It may already be referenced by teaching assignments.", 409);
      } else {
        if (!body.name?.trim()) return jsonError("Subject name is required.");
        if (action === "create_subject") {
          const { error } = await supabase.from("subjects").insert({ school_id: schoolId, name: body.name.trim(), code: body.code?.trim().toUpperCase() || null });
          if (error) return jsonError(error.code === "23505" ? "That subject or subject code already exists." : "Unable to create subject.", 409);
        } else {
          if (!body.subjectId) return jsonError("Subject is required.");
          const { error } = await supabase.from("subjects").update({ name: body.name.trim(), code: body.code?.trim().toUpperCase() || null, updated_at: new Date().toISOString() }).eq("id", body.subjectId).eq("school_id", schoolId);
          if (error) return jsonError(error.code === "23505" ? "That subject or subject code is already in use." : "Unable to update subject.", 409);
        }
      }
      return NextResponse.json({ ok: true, ...(await loadAcademicData(supabase, schoolId)) });
    }

    return jsonError("Unsupported academic setup action.");
  } catch (error) {
    console.error("Academic setup POST failed", error);
    return jsonError("Unable to update academic setup.", 500);
  }
}
