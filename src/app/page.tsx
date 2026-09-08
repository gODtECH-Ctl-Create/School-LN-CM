import { redirect } from "next/navigation";
import { createClient } from "@/src/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) redirect("/login");

  return (
    <main className="shell">
      <section className="card">
        <p className="eyebrow">School LN CM</p>
        <h1>Teacher workspace is coming together.</h1>
        <p className="muted">You are authenticated. The next layer is the school-aware dashboard, curriculum engine and lesson library.</p>
      </section>
    </main>
  );
}
