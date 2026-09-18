import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/src/lib/supabase/server";
import { validateCurriculumImportManifest } from "@/src/lib/curriculum-import";

const ADMIN_ROLES = ["school_admin", "academic_coordinator", "platform_admin"] as const;

function jsonError(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ error: message, ...(details ? { details } : {}) }, { status });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return jsonError("Authentication required.", 401);

  try {
    const body = (await request.json()) as {
      schoolId?: string;
      sessionId?: string;
      termId?: string;
      classId?: string;
      replaceExisting?: boolean;
      manifest?: unknown;
    };

    if (!body.schoolId || !body.sessionId || !body.termId || !body.classId) {
      return jsonError("School, academic session, term and class are required.");
    }

    const validation = validateCurriculumImportManifest(body.manifest);
    if (!validation.ok) return jsonError(validation.error);

    const { data: membership } = await supabase
      .from("school_memberships")
      .select("id, role")
      .eq("user_id", auth.user.id)
      .eq("school_id", body.schoolId)
      .eq("is_active", true)
      .in("role", [...ADMIN_ROLES])
      .maybeSingle();

    if (!membership) return jsonError("You do not have curriculum import access for this school.", 403);

    const [{ data: session }, { data: term }, { data: classRow }, { data: schoolSubjects }] = await Promise.all([
      supabase.from("academic_sessions").select("id, name").eq("id", body.sessionId).eq("school_id", body.schoolId).maybeSingle(),
      supabase.from("terms").select("id, name, academic_session_id").eq("id", body.termId).eq("academic_session_id", body.sessionId).maybeSingle(),
      supabase.from("classes").select("id, name").eq("id", body.classId).eq("school_id", body.schoolId).maybeSingle(),
      supabase.from("subjects").select("id, name, code").eq("school_id", body.schoolId),
    ]);

    if (!session || !term || !classRow) return jsonError("The selected curriculum context is invalid.", 400);

    const subjectsByCode = new Map(
      (schoolSubjects ?? []).filter((subject) => subject.code).map((subject) => [subject.code!.toLowerCase(), subject]),
    );
    const subjectsByName = new Map((schoolSubjects ?? []).map((subject) => [subject.name.toLowerCase(), subject]));

    const resolved = validation.value.subjects.map((subject) => {
      const match =
        (subject.subjectCode ? subjectsByCode.get(subject.subjectCode.toLowerCase()) : undefined) ??
        subjectsByName.get(subject.subjectName.toLowerCase());
      return { manifest: subject, match };
    });

    const missingSubjects = resolved.filter((item) => !item.match).map((item) => item.manifest.subjectName);
    if (missingSubjects.length) {
      return jsonError("Some subjects in the import do not exist in this school.", 400, { missingSubjects });
    }

    const subjectIds = resolved.map((item) => item.match!.id);
    const { data: existingCurricula } = await supabase
      .from("curricula")
      .select("id, subject_id, status")
      .eq("school_id", body.schoolId)
      .eq("academic_session_id", body.sessionId)
      .eq("term_id", body.termId)
      .eq("class_id", body.classId)
      .in("subject_id", subjectIds);

    const existingBySubject = new Map((existingCurricula ?? []).map((curriculum) => [curriculum.subject_id, curriculum]));
    const protectedExisting = (existingCurricula ?? []).filter((curriculum) => curriculum.status !== "draft");
    if (protectedExisting.length) {
      return jsonError("Published or archived curricula cannot be replaced by an import.", 409, {
        subjectIds: protectedExisting.map((item) => item.subject_id),
      });
    }

    if (!body.replaceExisting && (existingCurricula ?? []).length) {
      return jsonError("One or more draft curricula already exist. Enable replaceExisting only after reviewing them.", 409, {
        subjectIds: (existingCurricula ?? []).map((item) => item.subject_id),
      });
    }

    const imported: { curriculumId: string; subjectId: string; subjectName: string; topicCount: number }[] = [];
    const now = new Date().toISOString();

    for (const item of resolved) {
      const subject = item.match!;
      const manifestSubject = item.manifest;
      const existing = existingBySubject.get(subject.id);
      const curriculumTitle = manifestSubject.title || `${classRow.name} ${subject.name} · ${term.name}`;
      const curriculumPayload = {
        title: curriculumTitle,
        description: manifestSubject.description || null,
        week_count: manifestSubject.weekCount,
        topics_per_week: manifestSubject.topicsPerWeek,
        source_name: validation.value.source.name,
        source_url: validation.value.source.url ?? null,
        source_reference: validation.value.source.reference ?? null,
        source_checked_at: validation.value.source.checkedAt ?? now,
        updated_at: now,
      };

      let curriculumId = existing?.id;

      if (curriculumId) {
        const { error } = await supabase
          .from("curricula")
          .update(curriculumPayload)
          .eq("id", curriculumId)
          .eq("school_id", body.schoolId)
          .eq("status", "draft");
        if (error) throw error;
      } else {
        const { data: created, error } = await supabase
          .from("curricula")
          .insert({
            school_id: body.schoolId,
            academic_session_id: body.sessionId,
            term_id: body.termId,
            class_id: body.classId,
            subject_id: subject.id,
            status: "draft",
            created_by: auth.user.id,
            ...curriculumPayload,
          })
          .select("id")
          .single();
        if (error || !created) throw error ?? new Error("Unable to create curriculum.");
        curriculumId = created.id;
      }

      let { data: weeklyUnit } = await supabase
        .from("curriculum_units")
        .select("id")
        .eq("curriculum_id", curriculumId)
        .ilike("title", "Weekly plan")
        .limit(1)
        .maybeSingle();

      if (!weeklyUnit) {
        const { data: createdUnit, error } = await supabase
          .from("curriculum_units")
          .insert({
            curriculum_id: curriculumId,
            unit_number: 1,
            title: "Weekly plan",
            summary: "Imported week-by-week teaching plan",
            sort_order: 1,
            updated_at: now,
          })
          .select("id")
          .single();
        if (error || !createdUnit) throw error ?? new Error("Unable to create weekly curriculum unit.");
        weeklyUnit = createdUnit;
      } else if (existing) {
        const { error } = await supabase.from("curriculum_topics").delete().eq("unit_id", weeklyUnit.id);
        if (error) throw error;
      }

      const topicRows = manifestSubject.topics.map((topic) => ({
        unit_id: weeklyUnit!.id,
        title: topic.title,
        summary: topic.summary ?? null,
        week_number: topic.weekNumber,
        topic_number: topic.topicNumber,
        lesson_count: 1,
        sort_order: (topic.weekNumber - 1) * manifestSubject.topicsPerWeek + topic.topicNumber,
        updated_at: now,
      }));

      const { error: topicError } = await supabase.from("curriculum_topics").insert(topicRows);
      if (topicError) throw topicError;

      imported.push({
        curriculumId,
        subjectId: subject.id,
        subjectName: subject.name,
        topicCount: topicRows.length,
      });
    }

    return NextResponse.json({
      ok: true,
      imported,
      source: validation.value.source,
      context: {
        schoolId: body.schoolId,
        sessionId: session.id,
        termId: term.id,
        classId: classRow.id,
      },
    });
  } catch (error) {
    console.error("Curriculum import failed", error);
    return jsonError("Curriculum import failed. No published curriculum was modified.", 500);
  }
}
