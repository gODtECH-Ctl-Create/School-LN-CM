import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/src/lib/supabase/server";
import { createAdminClient } from "@/src/lib/supabase/admin";

export async function POST() {
  const supabase = await createServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user?.email) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const email = data.user.email.trim().toLowerCase();

    const { data: invitation, error: invitationError } = await admin
      .from("staff_invitations")
      .select("id, school_id, membership_id, email, first_name, last_name, status, expires_at")
      .eq("auth_user_id", data.user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (invitationError || !invitation) {
      return NextResponse.json(
        { error: "No active staff invitation was found for this account." },
        { status: 403 },
      );
    }

    if (invitation.email.trim().toLowerCase() !== email) {
      return NextResponse.json({ error: "Invitation email does not match this account." }, { status: 403 });
    }

    if (new Date(invitation.expires_at).getTime() <= Date.now()) {
      await admin
        .from("staff_invitations")
        .update({ status: "expired", updated_at: new Date().toISOString() })
        .eq("id", invitation.id)
        .eq("status", "pending");

      return NextResponse.json(
        { error: "This invitation has expired. Ask your school administrator to send a new invitation." },
        { status: 410 },
      );
    }

    if (!invitation.membership_id) {
      return NextResponse.json({ error: "Staff membership is not ready yet." }, { status: 409 });
    }

    const { error: membershipError } = await admin
      .from("school_memberships")
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq("id", invitation.membership_id)
      .eq("school_id", invitation.school_id)
      .eq("user_id", data.user.id);

    if (membershipError) {
      console.error("Invitation membership activation failed", membershipError);
      return NextResponse.json({ error: "Unable to activate your school membership." }, { status: 500 });
    }

    const { error: profileError } = await admin
      .from("profiles")
      .upsert({
        id: data.user.id,
        display_name: `${invitation.first_name} ${invitation.last_name}`,
        updated_at: new Date().toISOString(),
      });

    if (profileError) console.error("Profile update during invite acceptance failed", profileError);

    const { error: invitationUpdateError } = await admin
      .from("staff_invitations")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", invitation.id)
      .eq("status", "pending");

    if (invitationUpdateError) {
      console.error("Invitation status update failed", invitationUpdateError);
      await admin
        .from("school_memberships")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("id", invitation.membership_id);
      return NextResponse.json({ error: "Unable to finalize your invitation." }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      schoolId: invitation.school_id,
      message: "Your teacher account is ready.",
    });
  } catch (acceptanceError) {
    console.error("Invitation acceptance failed", acceptanceError);
    return NextResponse.json({ error: "Unable to complete account setup." }, { status: 500 });
  }
}
