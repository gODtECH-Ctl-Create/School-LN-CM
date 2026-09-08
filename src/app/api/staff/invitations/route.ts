import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/src/lib/supabase/server";
import { createAdminClient } from "@/src/lib/supabase/admin";

const ADMIN_ROLES = ["school_admin", "platform_admin"] as const;

type AssignmentInput = {
  classId: string;
  subjectId: string;
  academicSessionId?: string;
};

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function getActor() {
  const supabase = await createServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) return null;
  return { supabase, user: data.user };
}

async function assertSchoolAdmin(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  userId: string,
  schoolId: string,
) {
  const { data, error } = await supabase
    .from("school_memberships")
    .select("id, school_id, role")
    .eq("user_id", userId)
    .eq("school_id", schoolId)
    .eq("is_active", true)
    .in("role", [...ADMIN_ROLES])
    .maybeSingle();

  if (error || !data) return false;
  return true;
}

async function getAdminSchools(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  userId: string,
) {
  const { data: memberships, error } = await supabase
    .from("school_memberships")
    .select("school_id, role")
    .eq("user_id", userId)
    .eq("is_active", true)
    .in("role", [...ADMIN_ROLES]);

  if (error || !memberships?.length) return [];

  const schoolIds = [...new Set(memberships.map((membership) => membership.school_id))];
  const admin = createAdminClient();
  const { data: schools, error: schoolsError } = await admin
    .from("schools")
    .select("id, name, code")
    .in("id", schoolIds)
    .order("name");

  if (schoolsError) throw new Error("Unable to load schools.");
  return schools ?? [];
}

export async function GET(request: NextRequest) {
  try {
    const actor = await getActor();
    if (!actor) return jsonError("Authentication required.", 401);

    const schools = await getAdminSchools(actor.supabase, actor.user.id);
    if (!schools.length) return jsonError("You do not have staff-management access.", 403);

    const requestedSchoolId = request.nextUrl.searchParams.get("schoolId");
    const schoolId = requestedSchoolId ?? schools[0].id;

    if (!schools.some((school) => school.id === schoolId)) {
      return jsonError("You do not have access to that school.", 403);
    }

    const admin = createAdminClient();
    const [{ data: classes }, { data: subjects }, { data: sessions }, { data: invitations }] =
      await Promise.all([
        admin.from("classes").select("id, name, level").eq("school_id", schoolId).order("name"),
        admin.from("subjects").select("id, name, code").eq("school_id", schoolId).order("name"),
        admin
          .from("academic_sessions")
          .select("id, name, starts_on, ends_on, is_current")
          .eq("school_id", schoolId)
          .order("starts_on", { ascending: false }),
        admin
          .from("staff_invitations")
          .select(
            "id, email, first_name, last_name, role, staff_code, status, expires_at, accepted_at, created_at",
          )
          .eq("school_id", schoolId)
          .order("created_at", { ascending: false }),
      ]);

    return NextResponse.json({
      schools,
      school: schools.find((school) => school.id === schoolId),
      classes: classes ?? [],
      subjects: subjects ?? [],
      sessions: sessions ?? [],
      invitations: invitations ?? [],
    });
  } catch (error) {
    console.error("Staff GET failed", error);
    return jsonError("Unable to load staff management data.", 500);
  }
}

export async function POST(request: NextRequest) {
  const actor = await getActor();
  if (!actor) return jsonError("Authentication required.", 401);

  try {
    const body = (await request.json()) as {
      action?: "create" | "revoke";
      invitationId?: string;
      schoolId?: string;
      firstName?: string;
      lastName?: string;
      email?: string;
      assignments?: AssignmentInput[];
    };

    const action = body.action ?? "create";

    if (!body.schoolId) return jsonError("School is required.");
    if (!(await assertSchoolAdmin(actor.supabase, actor.user.id, body.schoolId))) {
      return jsonError("You do not have permission to manage staff for this school.", 403);
    }

    const admin = createAdminClient();

    if (action === "revoke") {
      if (!body.invitationId) return jsonError("Invitation is required.");

      const { data: invitation, error: invitationError } = await admin
        .from("staff_invitations")
        .select("id, status, membership_id")
        .eq("id", body.invitationId)
        .eq("school_id", body.schoolId)
        .maybeSingle();

      if (invitationError || !invitation) return jsonError("Invitation not found.", 404);
      if (!["pending", "provisioning"].includes(invitation.status)) {
        return jsonError("Only an active invitation can be revoked.", 409);
      }

      if (invitation.membership_id) {
        await admin
          .from("school_memberships")
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq("id", invitation.membership_id)
          .eq("school_id", body.schoolId);
      }

      const { error } = await admin
        .from("staff_invitations")
        .update({ status: "revoked", updated_at: new Date().toISOString() })
        .eq("id", invitation.id);

      if (error) return jsonError("Unable to revoke invitation.", 500);
      return NextResponse.json({ ok: true });
    }

    const firstName = body.firstName?.trim();
    const lastName = body.lastName?.trim();
    const email = body.email?.trim().toLowerCase();
    const assignments = Array.isArray(body.assignments) ? body.assignments : [];

    if (!firstName || !lastName || !email) {
      return jsonError("First name, last name and email are required.");
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) return jsonError("Enter a valid email address.");
    if (firstName.length > 80 || lastName.length > 80) return jsonError("Name is too long.");

    const { data: existingPending } = await admin
      .from("staff_invitations")
      .select("id")
      .eq("school_id", body.schoolId)
      .eq("email", email)
      .in("status", ["pending", "provisioning"])
      .maybeSingle();

    if (existingPending) return jsonError("An invitation is already pending for this email.", 409);

    const { data: session } = await admin
      .from("academic_sessions")
      .select("id")
      .eq("school_id", body.schoolId)
      .eq("is_current", true)
      .maybeSingle();

    const normalizedAssignments = assignments.map((assignment) => ({
      classId: assignment.classId,
      subjectId: assignment.subjectId,
      academicSessionId: assignment.academicSessionId ?? session?.id ?? "",
    }));

    const classIds = [...new Set(normalizedAssignments.map((item) => item.classId).filter(Boolean))];
    const subjectIds = [...new Set(normalizedAssignments.map((item) => item.subjectId).filter(Boolean))];
    const sessionIds = [...new Set(normalizedAssignments.map((item) => item.academicSessionId).filter(Boolean))];

    if (normalizedAssignments.some((item) => !item.academicSessionId)) {
      return jsonError("A current academic session is required before adding teaching assignments.");
    }

    const [{ data: classes }, { data: subjects }, { data: sessions }] = await Promise.all([
      admin.from("classes").select("id").eq("school_id", body.schoolId).in("id", classIds),
      admin.from("subjects").select("id").eq("school_id", body.schoolId).in("id", subjectIds),
      admin
        .from("academic_sessions")
        .select("id")
        .eq("school_id", body.schoolId)
        .in("id", sessionIds),
    ]);

    if (
      classes?.length !== classIds.length ||
      subjects?.length !== subjectIds.length ||
      sessions?.length !== sessionIds.length
    ) {
      return jsonError("One or more teaching assignments do not belong to this school.", 400);
    }

    const { data: staffCode, error: codeError } = await admin.rpc("allocate_staff_code", {
      target_school_id: body.schoolId,
      target_role: "teacher",
    });

    if (codeError || !staffCode) {
      console.error("Staff code allocation failed", codeError);
      return jsonError("Unable to allocate a Staff ID.", 500);
    }

    const redirectTo = `${request.nextUrl.origin}/accept-invitation`;
    const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      data: {
        full_name: `${firstName} ${lastName}`,
        school_id: body.schoolId,
        role: "teacher",
        staff_code: staffCode,
      },
      redirectTo,
    });

    if (inviteError || !inviteData.user) {
      console.error("Supabase invite failed", inviteError);
      return jsonError(
        inviteError?.message?.toLowerCase().includes("already")
          ? "This email already has a School LN CM account. Add-existing-user support will be handled separately."
          : "Unable to send the invitation email.",
        409,
      );
    }

    const { data: invitation, error: invitationInsertError } = await admin
      .from("staff_invitations")
      .insert({
        school_id: body.schoolId,
        auth_user_id: inviteData.user.id,
        email,
        first_name: firstName,
        last_name: lastName,
        role: "teacher",
        staff_code: staffCode,
        status: "provisioning",
      })
      .select("id")
      .single();

    if (invitationInsertError || !invitation) {
      console.error("Invitation record creation failed", invitationInsertError);
      return jsonError("The invitation was sent, but its school record could not be created.", 500);
    }

    const { data: membership, error: membershipError } = await admin
      .from("school_memberships")
      .insert({
        school_id: body.schoolId,
        user_id: inviteData.user.id,
        role: "teacher",
        is_active: false,
      })
      .select("id")
      .single();

    if (membershipError || !membership) {
      await admin
        .from("staff_invitations")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", invitation.id);
      console.error("Membership creation failed", membershipError);
      return jsonError("The invitation was sent, but the school membership could not be created.", 500);
    }

    const { error: profileError } = await admin
      .from("profiles")
      .upsert({
        id: inviteData.user.id,
        display_name: `${firstName} ${lastName}`,
        updated_at: new Date().toISOString(),
      });

    if (profileError) {
      await admin.from("school_memberships").delete().eq("id", membership.id);
      await admin
        .from("staff_invitations")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", invitation.id);
      console.error("Profile creation failed", profileError);
      return jsonError("The invitation was sent, but the staff profile could not be created.", 500);
    }

    const { error: staffProfileError } = await admin.from("staff_profiles").insert({
      membership_id: membership.id,
      staff_code: staffCode,
      first_name: firstName,
      last_name: lastName,
      job_title: "Teacher",
    });

    if (staffProfileError) {
      await admin.from("school_memberships").delete().eq("id", membership.id);
      await admin
        .from("staff_invitations")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", invitation.id);
      console.error("Staff profile creation failed", staffProfileError);
      return jsonError("The invitation was sent, but the staff record could not be created.", 500);
    }

    if (normalizedAssignments.length) {
      const { error: assignmentsError } = await admin.from("teacher_assignments").insert(
        normalizedAssignments.map((assignment) => ({
          membership_id: membership.id,
          class_id: assignment.classId,
          subject_id: assignment.subjectId,
          academic_session_id: assignment.academicSessionId,
        })),
      );

      if (assignmentsError) {
        await admin.from("school_memberships").delete().eq("id", membership.id);
        await admin
          .from("staff_invitations")
          .update({ status: "failed", updated_at: new Date().toISOString() })
          .eq("id", invitation.id);
        console.error("Teacher assignments creation failed", assignmentsError);
        return jsonError("The invitation was sent, but teaching assignments could not be created.", 500);
      }
    }

    const { error: finalizeError } = await admin
      .from("staff_invitations")
      .update({
        membership_id: membership.id,
        status: "pending",
        updated_at: new Date().toISOString(),
      })
      .eq("id", invitation.id);

    if (finalizeError) {
      console.error("Invitation finalization failed", finalizeError);
      return jsonError("The invitation was sent, but its status could not be finalized.", 500);
    }

    return NextResponse.json({
      ok: true,
      invitationId: invitation.id,
      staffCode,
      message: `Invitation sent to ${email}.`,
    });
  } catch (error) {
    console.error("Staff POST failed", error);
    return jsonError("Unable to complete staff onboarding.", 500);
  }
}
