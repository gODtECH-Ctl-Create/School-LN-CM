import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/src/lib/supabase/server";

const ADMIN_ROLES = ["school_admin", "academic_coordinator", "platform_admin"] as const;
type Action = "create_curriculum" | "update_curriculum" | "publish_curriculum" | "archive_curriculum" | "create_unit" | "update_unit" | "create_topic" | "update_topic";

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
  const { data: schools } = await supabase.from("schools").select("id, name, code").in("id", schoolIds).order("name");
  return { user: auth.user, memberships, schools: schools ?? [] };
}

function canManageSchool(context: Awaited<ReturnType<typeof getAdminContext>>, schoolId: string) {
  return Boolean(context?.memberships.some((membership) => membership.school_id === schoolId));
}

async function loadCurriculumData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  schoolId: string,
) {
  const [{ data: sessions }, { data: terms }, { data: classes }, { data: subjects }, { data: curricula }] = await Promise.all([
    supabase.from("academic_sessions").select("id, name, starts_on, ends_on, is_current").eq("school_id", schoolId).order("starts_on", { ascending: false }),
    supabase.from("terms").select("id, academic_session_id, name, term_number, starts_on, ends_on, is_current").order("term_number"),
    supabase.from("classes").select("id, name, level").eq("school_id", schoolId).order("name"),
    supabase.from("subjects").select("id, name, code").eq("school_id", schoolId).order("name"),
    supabase
      .from("curricula")
      .select("id, academic_session_id, term_id, class_id, subject_id, title, description, status, created_by, published_at, created_at, updated_at")
      .eq("school_id", schoolId)
      .order("updated_at", { ascending: false }),
  ]);

  const curriculumIds = (curricula ?? []).map((curriculum) => curriculum.id);
  const { data: units } = curriculumIds.length
    ? await supabase.from("curriculum_units").select("id, curriculum_id, unit_number, title, summary, sort_order, created_at, updated_at").in("curriculum_id", curriculumIds).order("sort_order")
    : { data: [] };
  const unitIds = (units ?? []).map((unit) => unit.id);
  const { data: topics } = unitIds.length
    ? await supabase.from("curriculum_topics").select("id, unit_id, title, summary, week_number, lesson_count, sort_order, created_at, updated_at").in("unit_id", unitIds).order("sort_order")
    : { data: [] };

  return {
    sessions: sessions ?? [],
    terms: (terms ?? []).filter((term) => (sessions ?? []).some((session) => session.id === term.academic_session_id)),
    classes: classes ?? [],
    subjects: subjects ?? [],
    curricula: curricula ?? [],
    units: units ?? [],
    topics: topics ?? [],
  };
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const context = await getAdminContext(supabase);
  if (!context) return jsonError("You do not have curriculum management access.", 403);

  const schoolId = request.nextUrl.searchParams.get("schoolId") ?? context.schools[0]?.id;
  if (!schoolId || !canManageSchool(context, schoolId)) return jsonError("You do not have access to that school.", 403);

  return NextResponse.json({ schools: context.schools, school: context.schools.find((school) => school.id === schoolId), ...(await loadCurriculumData(supabase, schoolId)) });
}

async function ensureContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  schoolId: string,
  sessionId: string,
  termId: string,
  classId: string,
  subjectId: string,
) {
  const [{ data: session }, { data: term }, { data: classRow }, { data: subject }] = await Promise.all([
    supabase.from("academic_sessions").select("id").eq("id", sessionId).eq("school_id", schoolId).maybeSingle(),
    supabase.from("terms").select("id, academic_session_id").eq("id", termId).eq("academic_session_id", sessionId).maybeSingle(),
    supabase.from("classes").select("id").eq("id", classId).eq("school_id", schoolId).maybeSingle(),
    supabase.from("subjects").select("id").eq("id", subjectId).eq("school_id", schoolId).maybeSingle(),
  ]);
  return Boolean(session && term && classRow && subject);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const context = await getAdminContext(supabase);
  if (!context) return jsonError("You do not have curriculum management access.", 403);

  try {
    const body = (await request.json()) as {
      action?: Action;
      schoolId?: string;
      curriculumId?: string;
      sessionId?: string;
      termId?: string;
      classId?: string;
      subjectId?: string;
      title?: string;
      description?: string;
      status?: "draft" | "published" | "archived";
      unitId?: string;
      unitNumber?: number;
      unitTitle?: string;
      unitSummary?: string;
      topicId?: string;
      topicTitle?: string;
      topicSummary?: string;
      weekNumber?: number | null;
      lessonCount?: number;
      sortOrder?: number;
    };

    const { action, schoolId } = body;
    if (!action || !schoolId) return jsonError("Action and school are required.");
    if (!canManageSchool(context, schoolId)) return jsonError("You do not have access to that school.", 403);

    if (action === "create_curriculum" || action === "update_curriculum") {
      if (!body.sessionId || !body.termId || !body.classId || !body.subjectId || !body.title?.trim()) return jsonError("Session, term, class, subject and curriculum title are required.");
      if (body.title.trim().length > 160) return jsonError("Curriculum title is too long.");
      if (!(await ensureContext(supabase, schoolId, body.sessionId, body.termId, body.classId, body.subjectId))) return jsonError("One or more curriculum context values do not belong to this school.", 400);
      if (action === "update_curriculum" && !body.curriculumId) return jsonError("Curriculum is required.");

      if (action === "create_curriculum") {
        const { error } = await supabase.from("curricula").insert({ school_id: schoolId, academic_session_id: body.sessionId, term_id: body.termId, class_id: body.classId, subject_id: body.subjectId, title: body.title.trim(), description: body.description?.trim() || null, created_by: context.user.id });
        if (error) return jsonError(error.code === "23505" ? "A curriculum already exists for this session, term, class and subject." : "Unable to create curriculum.", 409);
      } else {
        const { error } = await supabase.from("curricula").update({ academic_session_id: body.sessionId, term_id: body.termId, class_id: body.classId, subject_id: body.subjectId, title: body.title.trim(), description: body.description?.trim() || null, updated_at: new Date().toISOString() }).eq("id", body.curriculumId ?? "").eq("school_id", schoolId);
        if (error) return jsonError(error.code === "23505" ? "A curriculum already exists for this session, term, class and subject." : "Unable to update curriculum.", 409);
      }
      return NextResponse.json({ ok: true, ...(await loadCurriculumData(supabase, schoolId)) });
    }

    if (["publish_curriculum", "archive_curriculum"].includes(action)) {
      if (!body.curriculumId) return jsonError("Curriculum is required.");
      const { data: curriculum } = await supabase.from("curricula").select("id, status").eq("id", body.curriculumId).eq("school_id", schoolId).maybeSingle();
      if (!curriculum) return jsonError("Curriculum not found.", 404);

      if (action === "publish_curriculum") {
        const { count } = await supabase.from("curriculum_units").select("id", { count: "exact", head: true }).eq("curriculum_id", body.curriculumId);
        if (!count) return jsonError("Add at least one curriculum unit before publishing.", 409);
        const { error } = await supabase.from("curricula").update({ status: "published", published_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", body.curriculumId).eq("school_id", schoolId);
        if (error) return jsonError("Unable to publish curriculum.", 409);
      } else {
        const { error } = await supabase.from("curricula").update({ status: "archived", updated_at: new Date().toISOString() }).eq("id", body.curriculumId).eq("school_id", schoolId);
        if (error) return jsonError("Unable to archive curriculum.", 409);
      }
      return NextResponse.json({ ok: true, ...(await loadCurriculumData(supabase, schoolId)) });
    }

    if (action === "create_unit" || action === "update_unit") {
      if (!body.curriculumId || !body.unitTitle?.trim() || !body.unitNumber) return jsonError("Curriculum, unit number and unit title are required.");
      if (action === "update_unit" && !body.unitId) return jsonError("Unit is required.");
      const { data: curriculum } = await supabase.from("curricula").select("id, status").eq("id", body.curriculumId).eq("school_id", schoolId).maybeSingle();
      if (!curriculum) return jsonError("Curriculum not found.", 404);
      if (curriculum.status === "archived") return jsonError("Archived curricula cannot be changed.", 409);
      const payload = { curriculum_id: body.curriculumId, unit_number: body.unitNumber, title: body.unitTitle.trim(), summary: body.unitSummary?.trim() || null, sort_order: body.sortOrder ?? body.unitNumber, updated_at: new Date().toISOString() };
      const query = action === "create_unit" ? supabase.from("curriculum_units").insert(payload) : supabase.from("curriculum_units").update(payload).eq("id", body.unitId ?? "").eq("curriculum_id", body.curriculumId);
      const { error } = await query;
      if (error) return jsonError(error.code === "23505" ? "That unit number is already used in this curriculum." : "Unable to save unit.", 409);
      return NextResponse.json({ ok: true, ...(await loadCurriculumData(supabase, schoolId)) });
    }

    if (action === "create_topic" || action === "update_topic") {
      if (!body.unitId || !body.topicTitle?.trim()) return jsonError("Unit and topic title are required.");
      if (action === "update_topic" && !body.topicId) return jsonError("Topic is required.");
      const { data: unit } = await supabase.from("curriculum_units").select("id, curriculum_id").eq("id", body.unitId).maybeSingle();
      if (!unit) return jsonError("Unit not found.", 404);
      const { data: curriculum } = await supabase.from("curricula").select("id, school_id, status").eq("id", unit.curriculum_id).eq("school_id", schoolId).maybeSingle();
      if (!curriculum) return jsonError("Curriculum not found.", 404);
      if (curriculum.status === "archived") return jsonError("Archived curricula cannot be changed.", 409);
      const payload = { unit_id: body.unitId, title: body.topicTitle.trim(), summary: body.topicSummary?.trim() || null, week_number: body.weekNumber ?? null, lesson_count: body.lessonCount ?? 1, sort_order: body.sortOrder ?? 1, updated_at: new Date().toISOString() };
      const query = action === "create_topic" ? supabase.from("curriculum_topics").insert(payload) : supabase.from("curriculum_topics").update(payload).eq("id", body.topicId ?? "").eq("unit_id", body.unitId);
      const { error } = await query;
      if (error) return jsonError("Unable to save topic.", 409);
      return NextResponse.json({ ok: true, ...(await loadCurriculumData(supabase, schoolId)) });
    }

    return jsonError("Unsupported curriculum action.");
  } catch (error) {
    console.error("Curriculum POST failed", error);
    return jsonError("Unable to update curriculum.", 500);
  }
}
