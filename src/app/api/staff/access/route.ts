import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/src/lib/supabase/server";
import { createAdminClient } from "@/src/lib/supabase/admin";

const ADMIN_ROLES = ["school_admin", "platform_admin"] as const;

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  const supabase = await createServerClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return jsonError("Authentication required.", 401);

  try {
    const body = (await request.json()) as {
      schoolId?: string;
      teacherMembershipId?: string;
      isHeadTeacher?: boolean;
    };

    if (!body.schoolId || !body.teacherMembershipId || typeof body.isHeadTeacher !== "boolean") {
      return jsonError("School, teacher and access level are required.");
    }

    const { data: adminMembership } = await supabase
      .from("school_memberships")
      .select("id, role")
      .eq("user_id", auth.user.id)
      .eq("school_id", body.schoolId)
      .eq("is_active", true)
      .in("role", [...ADMIN_ROLES])
      .maybeSingle();

    if (!adminMembership) return jsonError("You do not have permission to change teacher access.", 403);

    const admin = createAdminClient();
    const { data: teacher, error: teacherError } = await admin
      .from("school_memberships")
      .select("id, role")
      .eq("id", body.teacherMembershipId)
      .eq("school_id", body.schoolId)
      .maybeSingle();

    if (teacherError || !teacher || teacher.role !== "teacher") {
      return jsonError("Teacher membership not found.", 404);
    }

    const { error: updateError } = await admin
      .from("school_memberships")
      .update({ is_head_teacher: body.isHeadTeacher, updated_at: new Date().toISOString() })
      .eq("id", body.teacherMembershipId)
      .eq("school_id", body.schoolId)
      .eq("role", "teacher");

    if (updateError) {
      console.error("Teacher access update failed", updateError);
      return jsonError("Unable to update teacher access.", 500);
    }

    return NextResponse.json({ ok: true, isHeadTeacher: body.isHeadTeacher });
  } catch (error) {
    console.error("Teacher access POST failed", error);
    return jsonError("Unable to update teacher access.", 500);
  }
}
