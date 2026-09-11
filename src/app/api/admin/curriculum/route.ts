import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/src/lib/supabase/server";

const ADMIN_ROLES = ["school_admin", "academic_coordinator", "platform_admin"] as const;
type WeekInput = { id?: string; weekNumber: number; title: string; summary?: string };
type Action =
  | "create_curriculum"
  | "update_curriculum"
  | "create_curricula"
  | "create_subject"
  | "publish_curriculum"
  | "archive_curriculum"
  | "create_unit"
  | "update_unit"
  | "create_topic"
  | "update_topic"
  | "save_weeks";

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
    supabase.from("subjects").select("id, name, code, is_custom").eq("school_id", schoolId).order("is_custom").order("name"),
    supabase.from("curricula").select("id, academic_session_id, term_id, class_id, subject_id, title, description, status, created_by, published_at, created_at, updated_at, week_count").eq("school_id", schoolId).order("updated_at", { ascending: false }),
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

async function ensureWeeklyUnit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  curriculumId: string,
) {
  const { data: existing } = await supabase.from("curriculum_units").select("id, unit_number, title").eq("curriculum_id", curriculumId).ilike("title", "Weekly plan").limit(1).maybeSingle();
  if (existing) return existing;

  const { data: lastUnit } = await supabase.from("curriculum_units").select("unit_number").eq("curriculum_id", curriculumId).order("unit_number", { ascending: false }).limit(1).maybeSingle();
  const unitNumber = (lastUnit?.unit_number ?? 0) + 1;
  const { data: created, error } = await supabase
    .from("curriculum_units")
    .insert({ curriculum_id: curriculumId, unit_number: unitNumber, title: "Weekly plan", summary: "Week-by-week teaching plan", sort_order: unitNumber, updated_at: new Date().toISOString() })
    .select("id, unit_number, title")
    .single();
  if (error || !created) throw error ?? new Error("Unable to create weekly plan.");
  return created;
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
      subjectIds?: string[];
      title?: string;
      description?: string;
      weekCount?: number;
      weeks?: WeekInput[];
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
      subjectName?: string;
    };

    const { action, schoolId } = body;
    if (!action || !schoolId) return jsonError("Action and school are required.");
    if (!canManageSchool(context, schoolId)) return jsonError("You do not have access to that school.", 403);

    if (action === "create_subject") {
      const name = body.subjectName?.trim();
      if (!name) return jsonError("Subject name is required.");
      const { data, error } = await supabase
        .from("subjects")
        .insert({ school_id: schoolId, name, code: null, is_custom: true })
        .select("id, name, code, is_custom")
        .single();
      if (error || !data) return jsonError(error?.code === "23505" ? "That subject already exists in this school." : "Unable to add custom subject.", 409);
      return NextResponse.json({ ok: true, subject: data, ...(await loadCurriculumData(supabase, schoolId)) });
    }

    if (action === "create_curricula") {
      if (!body.sessionId || !body.termId || !body.classId) return jsonError("Session, term and class are required.");
      const subjectIds = [...new Set((body.subjectIds ?? []).filter(Boolean))];
      const weekCount = Number(body.weekCount ?? 10);
      if (!subjectIds.length) return jsonError("Pick at least one subject.");
      if (!Number.isInteger(weekCount) || weekCount < 1 || weekCount > 52) return jsonError("Choose between 1 and 52 weeks.");

      const { data: classRow } = await supabase.from("classes").select("id, name").eq("id", body.classId).eq("school_id", schoolId).maybeSingle();
      const { data: termRow } = await supabase.from("terms").select("id, name").eq("id", body.termId).eq("academic_session_id", body.sessionId).maybeSingle();
      const { data: subjects } = await supabase.from("subjects").select("id, name").eq("school_id", schoolId).in("id", subjectIds);
      if (!classRow || !termRow || !subjects || subjects.length !== subjectIds.length) return jsonError("One or more curriculum selections do not belong to this school.", 400);

      const { data: existing } = await supabase
        .from("curricula")
        .select("id, subject_id")
        .eq("school_id", schoolId)
        .eq("academic_session_id", body.sessionId)
        .eq("term_id", body.termId)
        .eq("class_id", body.classId)
        .in("subject_id", subjectIds);
      const existingIds = new Set((existing ?? []).map((item) => item.subject_id));
      const missing = subjects.filter((subject) => !existingIds.has(subject.id));

      for (const subject of missing) {
        const title = `${classRow.name} ${subject.name} · ${termRow.name}`;
        const { data: curriculum, error: curriculumError } = await supabase
          .from("curricula")
          .insert({ school_id: schoolId, academic_session_id: body.sessionId, term_id: body.termId, class_id: body.classId, subject_id: subject.id, title, description: "Weekly curriculum plan", week_count: weekCount, created_by: context.user.id })
          .select("id")
          .single();
        if (curriculumError || !curriculum) throw curriculumError ?? new Error("Unable to create curriculum.");
        const unit = await ensureWeeklyUnit(supabase, curriculum.id);
        const weeklyTopics = Array.from({ length: weekCount }, (_, index) => ({ unit_id: unit.id, title: `Week ${index + 1}`, summary: null, week_number: index + 1, lesson_count: 1, sort_order: index + 1 }));
        const { error: topicsError } = await supabase.from("curriculum_topics").insert(weeklyTopics);
        if (topicsError) throw topicsError;
      }

      if (existing?.length) {
        const existingCurriculumIds = existing.map((item) => item.id);
        await supabase.from("curricula").update({ week_count: weekCount, updated_at: new Date().toISOString() }).in("id", existingCurriculumIds).eq("school_id", schoolId);
        for (const curriculum of existing) {
          const unit = await ensureWeeklyUnit(supabase, curriculum.id);
          const { data: currentWeeks } = await supabase.from("curriculum_topics").select("week_number").eq("unit_id", unit.id).not("week_number", "is", null);
          const existingWeeks = new Set((currentWeeks ?? []).map((item) => item.week_number));
          const missingTopics = Array.from({ length: weekCount }, (_, index) => index + 1)
            .filter((week) => !existingWeeks.has(week))
            .map((week) => ({ unit_id: unit.id, title: `Week ${week}`, summary: null, week_number: week, lesson_count: 1, sort_order: week }));
          if (missingTopics.length) await supabase.from("curriculum_topics").insert(missingTopics);
        }
      }

      return NextResponse.json({ ok: true, ...(await loadCurriculumData(supabase, schoolId)) });
    }

    if (action === "create_curriculum" || action === "update_curriculum") {
      if (!body.sessionId || !body.termId || !body.classId || !body.subjectId || !body.title?.trim()) return jsonError("Session, term, class, subject and curriculum title are required.");
      if (body.title.trim().length > 160) return jsonError("Curriculum title is too long.");
      if (!(await ensureContext(supabase, schoolId, body.sessionId, body.termId, body.classId, body.subjectId))) return jsonError("One or more curriculum context values do not belong to this school.", 400);
      if (action === "update_curriculum" && !body.curriculumId) return jsonError("Curriculum is required.");

      if (action === "create_curriculum") {
        const { error } = await supabase.from("curricula").insert({ school_id: schoolId, academic_session_id: body.sessionId, term_id: body.termId, class_id: body.classId, subject_id: body.subjectId, title: body.title.trim(), description: body.description?.trim() || null, week_count: body.weekCount ?? 10, created_by: context.user.id });
        if (error) return jsonError(error.code === "23505" ? "A curriculum already exists for this session, term, class and subject." : "Unable to create curriculum.", 409);
      } else {
        const { error } = await supabase.from("curricula").update({ academic_session_id: body.sessionId, term_id: body.termId, class_id: body.classId, subject_id: body.subjectId, title: body.title.trim(), description: body.description?.trim() || null, updated_at: new Date().toISOString(), ...(body.weekCount ? { week_count: body.weekCount } : {}) }).eq("id", body.curriculumId ?? "").eq("school_id", schoolId);
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

    if (action === "save_weeks") {
      if (!body.curriculumId || !Array.isArray(body.weeks) || !body.weeks.length) return jsonError("Curriculum and week entries are required.");
      const { data: curriculum } = await supabase.from("curricula").select("id, status").eq("id", body.curriculumId).eq("school_id", schoolId).maybeSingle();
      if (!curriculum) return jsonError("Curriculum not found.", 404);
      if (curriculum.status === "archived") return jsonError("Archived curricula cannot be changed.", 409);
      const unit = await ensureWeeklyUnit(supabase, body.curriculumId);
      const weeks = body.weeks.filter((week) => Number.isInteger(week.weekNumber) && week.weekNumber >= 1 && week.weekNumber <= 52).slice(0, 52);
      for (const week of weeks) {
        const title = week.title?.trim() || `Week ${week.weekNumber}`;
        const summary = week.summary?.trim() || null;
        if (week.id) {
          const { error } = await supabase.from("curriculum_topics").update({ title, summary, week_number: week.weekNumber, sort_order: week.weekNumber, updated_at: new Date().toISOString() }).eq("id", week.id).eq("unit_id", unit.id);
          if (error) throw error;
        } else {
          const { data: existingWeek } = await supabase.from("curriculum_topics").select("id").eq("unit_id", unit.id).eq("week_number", week.weekNumber).maybeSingle();
          if (existingWeek) {
            const { error } = await supabase.from("curriculum_topics").update({ title, summary, sort_order: week.weekNumber, updated_at: new Date().toISOString() }).eq("id", existingWeek.id);
            if (error) throw error;
          } else {
            const { error } = await supabase.from("curriculum_topics").insert({ unit_id: unit.id, title, summary, week_number: week.weekNumber, lesson_count: 1, sort_order: week.weekNumber });
            if (error) throw error;
          }
        }
      }
      const maxWeek = Math.max(...weeks.map((week) => week.weekNumber));
      await supabase.from("curricula").update({ week_count: maxWeek, updated_at: new Date().toISOString() }).eq("id", body.curriculumId).eq("school_id", schoolId);
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
