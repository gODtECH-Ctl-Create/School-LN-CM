import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/src/lib/supabase/server";

type Action = "create" | "update" | "publish" | "archive";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function getTeacherContext(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return null;

  const { data: membership, error } = await supabase
    .from("school_memberships")
    .select("id, school_id, role")
    .eq("user_id", auth.user.id)
    .eq("is_active", true)
    .eq("role", "teacher")
    .limit(1)
    .maybeSingle();

  if (error || !membership) return null;
  return { user: auth.user, membership };
}

async function loadLessons(
  supabase: Awaited<ReturnType<typeof createClient>>,
  membershipId: string,
  schoolId: string,
) {
  const [{ data: assignments }, { data: notes }] = await Promise.all([
    supabase
      .from("teacher_assignments")
      .select("class_id, subject_id, academic_session_id")
      .eq("membership_id", membershipId),
    supabase
      .from("lesson_notes")
      .select("id, curriculum_id, curriculum_unit_id, curriculum_topic_id, academic_session_id, term_id, class_id, subject_id, title, duration_minutes, learning_objectives, lesson_introduction, lesson_content, teacher_activities, learner_activities, assessment, homework, materials, status, created_at, updated_at")
      .eq("school_id", schoolId)
      .eq("teacher_membership_id", membershipId)
      .order("updated_at", { ascending: false }),
  ]);

  const classIds = [...new Set((assignments ?? []).map((item) => item.class_id))];
  const subjectIds = [...new Set((assignments ?? []).map((item) => item.subject_id))];
  const sessionIds = [...new Set((assignments ?? []).map((item) => item.academic_session_id))];
  const noteClassIds = [...new Set((notes ?? []).map((item) => item.class_id))];
  const noteSubjectIds = [...new Set((notes ?? []).map((item) => item.subject_id))];
  const noteSessionIds = [...new Set((notes ?? []).map((item) => item.academic_session_id))];
  const termIds = [...new Set((notes ?? []).map((item) => item.term_id))];

  const [{ data: classes }, { data: subjects }, { data: sessions }, { data: terms }, { data: topics }, { data: schools }] = await Promise.all([
    supabase.from("classes").select("id, name, level").in("id", [...new Set([...classIds, ...noteClassIds])]),
    supabase.from("subjects").select("id, name, code").in("id", [...new Set([...subjectIds, ...noteSubjectIds])]),
    supabase.from("academic_sessions").select("id, name, is_current").in("id", [...new Set([...sessionIds, ...noteSessionIds])]),
    termIds.length ? supabase.from("terms").select("id, academic_session_id, name, term_number, is_current").in("id", termIds) : Promise.resolve({ data: [] }),
    supabase.from("curriculum_topics").select("id, unit_id, title, week_number, lesson_count").in("id", (notes ?? []).map((item) => item.curriculum_topic_id).filter(Boolean) as string[]),
    supabase.from("schools").select("id, name, code").eq("id", schoolId).maybeSingle(),
  ]);

  return {
    school: schools,
    assignments: assignments ?? [],
    classes: classes ?? [],
    subjects: subjects ?? [],
    sessions: sessions ?? [],
    terms: terms ?? [],
    topics: topics ?? [],
    notes: notes ?? [],
  };
}

export async function GET() {
  const supabase = await createClient();
  const context = await getTeacherContext(supabase);
  if (!context) return jsonError("You do not have access to the teacher workspace.", 403);

  try {
    return NextResponse.json(await loadLessons(supabase, context.membership.id, context.membership.school_id));
  } catch (error) {
    console.error("Teacher lessons GET failed", error);
    return jsonError("Unable to load your lesson workspace.", 500);
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const context = await getTeacherContext(supabase);
  if (!context) return jsonError("You do not have access to the teacher workspace.", 403);

  try {
    const body = (await request.json()) as {
      action?: Action;
      lessonId?: string;
      academicSessionId?: string;
      termId?: string;
      classId?: string;
      subjectId?: string;
      curriculumId?: string | null;
      curriculumUnitId?: string | null;
      curriculumTopicId?: string | null;
      title?: string;
      durationMinutes?: number;
      learningObjectives?: string;
      lessonIntroduction?: string;
      lessonContent?: string;
      teacherActivities?: string;
      learnerActivities?: string;
      assessment?: string;
      homework?: string;
      materials?: string;
    };

    const action = body.action ?? "create";
    const { membership } = context;

    if (action === "publish" || action === "archive") {
      if (!body.lessonId) return jsonError("Lesson note is required.");
      const { data: existing, error } = await supabase
        .from("lesson_notes")
        .select("id, status, lesson_content")
        .eq("id", body.lessonId)
        .eq("teacher_membership_id", membership.id)
        .eq("school_id", membership.school_id)
        .maybeSingle();
      if (error || !existing) return jsonError("Lesson note not found.", 404);

      if (action === "publish") {
        if (!existing.lesson_content?.trim()) return jsonError("Add lesson content before publishing the note.", 409);
        const { error: updateError } = await supabase
          .from("lesson_notes")
          .update({ status: "published", updated_at: new Date().toISOString() })
          .eq("id", existing.id)
          .eq("teacher_membership_id", membership.id);
        if (updateError) return jsonError("Unable to publish lesson note.", 409);
      } else {
        const { error: updateError } = await supabase
          .from("lesson_notes")
          .update({ status: "archived", updated_at: new Date().toISOString() })
          .eq("id", existing.id)
          .eq("teacher_membership_id", membership.id);
        if (updateError) return jsonError("Unable to archive lesson note.", 409);
      }
      return NextResponse.json({ ok: true, ...(await loadLessons(supabase, membership.id, membership.school_id)) });
    }

    const title = body.title?.trim();
    if (!title) return jsonError("Lesson title is required.");
    if (!body.academicSessionId || !body.termId || !body.classId || !body.subjectId) return jsonError("Session, term, class and subject are required.");
    if (title.length > 180) return jsonError("Lesson title is too long.");

    const durationMinutes = Math.min(240, Math.max(5, Number(body.durationMinutes) || 40));

    const { data: assignment } = await supabase
      .from("teacher_assignments")
      .select("id")
      .eq("membership_id", membership.id)
      .eq("academic_session_id", body.academicSessionId)
      .eq("class_id", body.classId)
      .eq("subject_id", body.subjectId)
      .maybeSingle();

    if (!assignment) return jsonError("That class and subject are not assigned to you for this academic session.", 403);

    const { data: term } = await supabase
      .from("terms")
      .select("id")
      .eq("id", body.termId)
      .eq("academic_session_id", body.academicSessionId)
      .maybeSingle();
    if (!term) return jsonError("The selected term does not belong to this academic session.", 400);

    if (body.curriculumTopicId) {
      const { data: topic } = await supabase
        .from("curriculum_topics")
        .select("id, unit_id, curriculum_id")
        .eq("id", body.curriculumTopicId)
        .maybeSingle();
      if (!topic) return jsonError("Selected curriculum topic was not found.", 400);

      const { data: curriculum } = await supabase
        .from("curricula")
        .select("id, school_id, academic_session_id, term_id, class_id, subject_id")
        .eq("id", topic.curriculum_id)
        .eq("school_id", membership.school_id)
        .maybeSingle();
      if (!curriculum || curriculum.academic_session_id !== body.academicSessionId || curriculum.term_id !== body.termId || curriculum.class_id !== body.classId || curriculum.subject_id !== body.subjectId) {
        return jsonError("The curriculum topic does not match this lesson context.", 400);
      }
    }

    const payload = {
      school_id: membership.school_id,
      teacher_membership_id: membership.id,
      curriculum_id: body.curriculumId ?? null,
      curriculum_unit_id: body.curriculumUnitId ?? null,
      curriculum_topic_id: body.curriculumTopicId ?? null,
      academic_session_id: body.academicSessionId,
      term_id: body.termId,
      class_id: body.classId,
      subject_id: body.subjectId,
      title,
      duration_minutes: durationMinutes,
      learning_objectives: body.learningObjectives?.trim() || null,
      lesson_introduction: body.lessonIntroduction?.trim() || null,
      lesson_content: body.lessonContent?.trim() || null,
      teacher_activities: body.teacherActivities?.trim() || null,
      learner_activities: body.learnerActivities?.trim() || null,
      assessment: body.assessment?.trim() || null,
      homework: body.homework?.trim() || null,
      materials: body.materials?.trim() || null,
      updated_at: new Date().toISOString(),
    };

    if (action === "update") {
      if (!body.lessonId) return jsonError("Lesson note is required.");
      const { error } = await supabase
        .from("lesson_notes")
        .update(payload)
        .eq("id", body.lessonId)
        .eq("school_id", membership.school_id)
        .eq("teacher_membership_id", membership.id);
      if (error) return jsonError("Unable to update lesson note.", 409);
    } else {
      const { error } = await supabase.from("lesson_notes").insert(payload);
      if (error) return jsonError(error.code === "23505" ? "A lesson note with this title already exists for this class and subject." : "Unable to create lesson note.", 409);
    }

    return NextResponse.json({ ok: true, ...(await loadLessons(supabase, membership.id, membership.school_id)) });
  } catch (error) {
    console.error("Teacher lessons POST failed", error);
    return jsonError("Unable to save lesson note.", 500);
  }
}
