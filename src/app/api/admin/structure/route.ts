import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/src/lib/supabase/server";

const ADMIN_ROLES = ["school_admin", "academic_coordinator", "platform_admin"] as const;
const CAPABILITIES = ["preschool", "nursery", "primary", "secondary"] as const;

type Capability = (typeof CAPABILITIES)[number];

const LEVEL_CLASS_MAP: Record<Capability, string[]> = {
  preschool: ["Preschool 1", "Preschool 2"],
  nursery: ["Nursery 1", "Nursery 2", "Nursery 3", "Nursery 4"],
  primary: ["Primary 1", "Primary 2", "Primary 3", "Primary 4", "Primary 5", "Primary 6"],
  secondary: ["JSS 1", "JSS 2", "JSS 3", "SS 1", "SS 2", "SS 3"],
};

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function getContext(supabase: Awaited<ReturnType<typeof createClient>>, schoolId: string) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data: membership } = await supabase
    .from("school_memberships")
    .select("school_id, role")
    .eq("user_id", auth.user.id)
    .eq("school_id", schoolId)
    .eq("is_active", true)
    .in("role", [...ADMIN_ROLES])
    .maybeSingle();
  if (!membership) return null;
  const { data: school } = await supabase.from("schools").select("id, name, code, capabilities").eq("id", schoolId).maybeSingle();
  return school ? { user: auth.user, school } : null;
}

function makeCode(name: string, used: Set<string>, current?: string) {
  const words = name.toUpperCase().replace(/[^A-Z0-9 ]+/g, " ").split(/\s+/).filter(Boolean);
  const base = words.length > 1 ? words.map((word) => word[0]).join("").slice(0, 6) : (words[0] ?? "SUB").slice(0, 4);
  let code = base || "SUB";
  let counter = 2;
  while (used.has(code) && code !== current) code = `${base.slice(0, Math.max(1, 6 - String(counter).length))}${counter++}`;
  return code;
}

async function load(supabase: Awaited<ReturnType<typeof createClient>>, schoolId: string) {
  const [{ data: school }, { data: classes }, { data: subjects }, { data: links }] = await Promise.all([
    supabase.from("schools").select("id, name, code, capabilities").eq("id", schoolId).single(),
    supabase.from("classes").select("id, name, level, is_active").eq("school_id", schoolId).eq("is_active", true).order("level").order("name"),
    supabase.from("subjects").select("id, name, code, is_custom").eq("school_id", schoolId).order("name"),
    supabase.from("class_subjects").select("class_id, subject_id").in("class_id", (await supabase.from("classes").select("id").eq("school_id", schoolId).eq("is_active", true)).data?.map((row) => row.id) ?? []),
  ]);

  const assignments = new Map<string, string[]>();
  for (const link of links ?? []) assignments.set(link.subject_id, [...(assignments.get(link.subject_id) ?? []), link.class_id]);
  return {
    school: school ?? { id: schoolId, name: "", code: "", capabilities: [] },
    classes: classes ?? [],
    subjects: (subjects ?? []).map((subject) => ({ ...subject, class_ids: assignments.get(subject.id) ?? [] })),
  };
}

export async function GET(request: NextRequest) {
  const schoolId = request.nextUrl.searchParams.get("schoolId");
  if (!schoolId) return errorResponse("School is required.");
  const supabase = await createClient();
  if (!(await getContext(supabase, schoolId))) return errorResponse("You do not have access to this school.", 403);
  return NextResponse.json(await load(supabase, schoolId));
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    action?: "save_class_set" | "save_subject";
    schoolId?: string;
    level?: string;
    classes?: string[];
    subjectId?: string;
    subjectName?: string;
    classIds?: string[];
  };
  const schoolId = body.schoolId;
  if (!schoolId || !body.action) return errorResponse("School and action are required.");
  const supabase = await createClient();
  if (!(await getContext(supabase, schoolId))) return errorResponse("You do not have access to this school.", 403);

  if (body.action === "save_class_set") {
    const level = body.level?.trim().toLowerCase() as Capability;
    if (!CAPABILITIES.includes(level)) return errorResponse("Choose a valid school capability.");
    const names = [...new Set((body.classes ?? []).map((name) => name.trim()).filter(Boolean))];
    if (!names.length) return errorResponse("Select at least one class for this level.");

    const { data: existing } = await supabase.from("classes").select("id, name").eq("school_id", schoolId).eq("level", level);
    const selected = new Set(names.map((name) => name.toLowerCase()));
    const { error: deactivateError } = await supabase
      .from("classes")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("school_id", schoolId)
      .eq("level", level);
    if (deactivateError) return errorResponse("Unable to reset this class set.", 409);

    for (const name of names) {
      const found = existing?.find((item) => item.name.toLowerCase() === name.toLowerCase());
      const query = found
        ? supabase.from("classes").update({ is_active: true, level, updated_at: new Date().toISOString() }).eq("id", found.id).eq("school_id", schoolId)
        : supabase.from("classes").insert({ school_id: schoolId, name, level, is_active: true });
      const { error } = await query;
      if (error) return errorResponse(error.code === "23505" ? `Class ${name} already exists.` : "Unable to save class set.", 409);
    }
    return NextResponse.json({ ok: true, ...(await load(supabase, schoolId)) });
  }

  if (body.action === "save_subject") {
    const name = body.subjectName?.trim();
    if (!name) return errorResponse("Subject name is required.");
    const classIds = [...new Set(body.classIds ?? [])];
    if (!classIds.length) return errorResponse("Choose at least one class for this subject.");

    const { data: validClasses } = await supabase.from("classes").select("id").eq("school_id", schoolId).eq("is_active", true).in("id", classIds);
    if (!validClasses || validClasses.length !== classIds.length) return errorResponse("One or more selected classes are invalid.", 400);

    const { data: subjects } = await supabase.from("subjects").select("id, code").eq("school_id", schoolId);
    const usedCodes = new Set((subjects ?? []).map((subject) => subject.code).filter(Boolean) as string[]);
    let subjectId = body.subjectId;
    if (subjectId) {
      const current = subjects?.find((subject) => subject.id === subjectId);
      if (!current) return errorResponse("Subject not found.", 404);
      const { error } = await supabase.from("subjects").update({ name, code: makeCode(name, usedCodes, current.code ?? undefined), updated_at: new Date().toISOString() }).eq("id", subjectId).eq("school_id", schoolId);
      if (error) return errorResponse("Unable to update subject.", 409);
    } else {
      const { data: created, error } = await supabase.from("subjects").insert({ school_id: schoolId, name, code: makeCode(name, usedCodes), is_custom: true }).select("id").single();
      if (error || !created) return errorResponse(error?.code === "23505" ? "That subject already exists in this school." : "Unable to add subject.", 409);
      subjectId = created.id;
    }

    await supabase.from("class_subjects").delete().eq("subject_id", subjectId);
    const { error: linkError } = await supabase.from("class_subjects").insert(classIds.map((classId) => ({ class_id: classId, subject_id: subjectId })));
    if (linkError) return errorResponse("Unable to assign subject to the selected classes.", 409);
    return NextResponse.json({ ok: true, ...(await load(supabase, schoolId)) });
  }

  return errorResponse("Unsupported structure action.");
}
