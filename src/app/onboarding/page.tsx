import { redirect } from "next/navigation";
import { createClient } from "@/src/lib/supabase/server";
import OnboardingClient from "./onboarding-client";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: membership } = await supabase
    .from("school_memberships")
    .select("id")
    .eq("user_id", auth.user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (membership) redirect("/");

  return <OnboardingClient displayName={auth.user.user_metadata?.full_name ?? ""} email={auth.user.email ?? ""} />;
}
