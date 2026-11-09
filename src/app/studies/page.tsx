import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/app/profile-actions";
import { AccountMenu } from "@/components/AccountMenu";
import { CompleteProfileForm } from "@/components/CompleteProfileForm";
import { StudyGroupSection } from "@/components/StudyGroupSection";
import { buildDemographicsPath, hasPendingDemographicQuestions } from "@/lib/demographics";
import { DEMOGRAPHIC_SKIPS_COOKIE, readDemographicSkips } from "@/lib/demographic-skips";
import { buildNotificationPreferencesPath, fetchNotificationPreferences, NOTIFICATION_SKIPS_COOKIE, readNotificationSkips } from "@/lib/notification-preferences";
import { fetchPublicStudyOverview, groupDashboardStudies } from "@/lib/studies";
import { fetchDashboardParticipations } from "@/lib/study-participation";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "All studies | FunnyStudy" };
type Profile = { first_name: string | null; last_name: string | null };

export default async function AllStudiesPage({ searchParams }: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const message = Array.isArray(params.message) ? params.message[0] : params.message;
  const supabase = await createClient();
  const studyNow = new Date();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const cookieStore = await cookies();
  const skippedNotifications = readNotificationSkips(cookieStore.get(NOTIFICATION_SKIPS_COOKIE)?.value, user.id);
  if ((await fetchNotificationPreferences(supabase, user.id, skippedNotifications)).pending.length) {
    redirect(buildNotificationPreferencesPath("/studies"));
  }

  const skippedQuestionIds = readDemographicSkips(
    cookieStore.get(DEMOGRAPHIC_SKIPS_COOKIE)?.value,
    user.id
  );

  if (await hasPendingDemographicQuestions(supabase, user.id, skippedQuestionIds)) {
    redirect(buildDemographicsPath({ next: "/studies", skippedQuestionIds }));
  }

  const [
    { data: profileData },
    { studies: studyOverview, error: studyOverviewError },
  ] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", user.id)
        .single(),
      fetchPublicStudyOverview(supabase, studyNow),
    ]);

  const profile = profileData as Profile | null;

  const fullName = [profile?.first_name, profile?.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  const displayName = fullName || user.email || "your account";

  if (!profile?.first_name || !profile?.last_name) {
    return (
      <CompleteProfileForm
        userEmail={user.email}
        initialFirst={profile?.first_name ?? ""}
        initialLast={profile?.last_name ?? ""}
        nextPath="/studies"
        message={message}
      />
    );
  }

  if (studyOverviewError) {
    console.error("[AllStudies] load study overview failed", studyOverviewError);
  }

  const { participations, error: participationError } = await fetchDashboardParticipations(supabase, user.id);
  if (participationError) {
    console.error("[AllStudies] load study participation failed", participationError);
  }

  const groups = groupDashboardStudies(studyOverview, studyNow);
  return <div className="study-overview studies-page participant-document-page px-4 pt-5 pb-24 sm:px-6">
    <main className="studies-content mx-auto w-full max-w-[960px] px-1 pb-6">
      <Link href="/" className="studies-back">← Back to home</Link>
      <header className="studies-header">
        <p className="overview-brand">FunnyStudy</p>
        <p className="studies-eyebrow">Your participation</p>
        <h1>All studies</h1>
        <p className="overview-muted">See what’s available now, what’s coming up, and what recently closed.</p>
      </header>
      {studyOverviewError ? <section role="alert" className="overview-message overview-message-error">
        <h2 className="text-xl font-semibold">We couldn&apos;t load studies</h2>
        <p className="overview-muted mt-3">Please refresh and try again.</p>
        <form action="/studies" method="get"><button type="submit" className="overview-link mt-4 inline-block font-semibold">Try again</button></form>
      </section> : <>
        {participationError ? <p role="alert" className="overview-message">We couldn&apos;t load your study completion status. Please refresh to try again.</p> : null}
        <StudyGroupSection kind="active" items={groups.active} participations={participations} participationError={Boolean(participationError)} />
        <StudyGroupSection kind="upcoming" items={groups.upcoming} participations={participations} participationError={Boolean(participationError)} />
        <StudyGroupSection kind="closed" items={groups.closed} participations={participations} participationError={Boolean(participationError)} />
      </>}
    </main>
    <AccountMenu displayName={displayName} email={user.email} signOutAction={signOut} />
  </div>;
}
