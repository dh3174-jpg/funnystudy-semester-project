import Link from "next/link";
import { LocalDateTime } from "@/components/LocalDateTime";
import { groupDashboardStudies, type StudyRow } from "@/lib/studies";
import { isStudyCompleted, selectFeaturedStudy, type StudyParticipation } from "@/lib/study-participation";

export function StudyDashboard({
  firstName, studies, participations, studyError, participationError, now,
}: {
  firstName: string;
  studies: StudyRow[];
  participations: StudyParticipation[];
  studyError: boolean;
  participationError: boolean;
  now: Date;
}) {
  const groups = groupDashboardStudies(studies, now);
  const byStudy = new Map(participations.map((row) => [row.study_id, row]));
  const featured = participationError ? null : selectFeaturedStudy(groups.active, participations);
  const next = groups.upcoming[0];
  const completedCount = participations.filter(isStudyCompleted).length;

  function timing(study: StudyRow, upcoming = false) {
    const value = upcoming ? study.start_datetime_utc : study.end_datetime_utc;
    return <p className="overview-muted text-sm leading-6">
      {value ? <>{upcoming ? "Opens " : "Closes "}<LocalDateTime value={value} /></> : "No end date"}
    </p>;
  }

  function studyList(items: StudyRow[], kind: "active" | "upcoming" | "closed") {
    if (!items.length) return <p className="overview-muted text-sm">
      {kind === "active" ? "No active studies" : kind === "upcoming" ? "No upcoming studies scheduled yet." : "No studies closed in the past 30 days."}
    </p>;
    return <ul className="divide-y divide-[var(--overview-border)]">
      {items.map((study) => {
        const participation = byStudy.get(study.id);
        const completed = !participationError && isStudyCompleted(participation);
        const canOpen = completed || kind === "active";
        return <li key={study.id} className="space-y-2 py-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold">Study {study.id}</h3>
            <span className="overview-muted text-xs">
              {kind === "closed" ? "Closed" : kind === "upcoming" ? "Upcoming" : "Available now"}
              {completed ? " · Completed" : !participationError && participation?.started_at ? " · In progress" : ""}
            </span>
          </div>
          {kind === "closed" ? <p className="overview-muted text-sm leading-6">
            Closed <LocalDateTime value={study.end_datetime_utc!} />.
            {completed ? " Thanks for taking part." : " Participation is no longer available."}
          </p> : timing(study, kind === "upcoming")}
          {canOpen ? <Link prefetch={false} href={`/study/${study.id}`} className="overview-link inline-block text-sm font-semibold">
            {completed ? "View study stats" : participationError ? "View study" : participation?.started_at ? "Continue Study" : "Start Study"} <span aria-hidden>→</span>
          </Link> : null}
        </li>;
      })}
    </ul>;
  }

  return <div className="overview-composition space-y-5 sm:space-y-6">
    <header className="text-center">
      <p className="overview-brand text-lg font-semibold tracking-tight">FunnyStudy <span aria-hidden className="overview-flower">✳</span></p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Hi, {firstName}</h1>
      <p className="overview-muted mt-2 text-sm leading-6">A little humor. A contribution to research.</p>
    </header>
    {studyError ? <section role="alert" className="overview-panel p-7 text-center">
      <h2 className="text-xl font-semibold">We couldn&apos;t load studies</h2>
      <p className="overview-muted mt-3">Please refresh and try again.</p>
      <form action="/" method="get"><button type="submit" className="overview-link mt-4 inline-block cursor-pointer font-semibold">Try again</button></form>
    </section> : <>
      {participationError ? <p role="alert" className="overview-panel p-4 text-sm">
        We couldn&apos;t load your study completion status. Please refresh to try again.
      </p> : null}
      <section aria-labelledby="available-heading" className={`overview-feature ${featured ? "overview-feature-active" : "overview-feature-empty"} rounded-3xl border px-6 py-7 text-center sm:px-10 sm:py-8`}>
        <span aria-hidden className="overview-corner-mark">✳</span>
        <h2 id="available-heading" className="text-xs font-bold uppercase tracking-[0.18em]">Available now</h2>
        {featured ? <>
          <h3 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Study {featured.id}</h3>
          <div className="mt-3">{timing(featured)}</div>
          <Link prefetch={false} href={`/study/${featured.id}`} className="participant-primary overview-button mt-5 inline-flex min-h-12 items-center justify-center rounded-xl px-7 py-3 font-semibold">
            {byStudy.get(featured.id)?.started_at ? "Continue Study" : "Start Study"} <span aria-hidden className="ml-3">→</span>
          </Link>
        </> : <>
          <h3 className="mt-4 text-xl font-semibold">
            {!groups.active.length ? "No active studies" : participationError ? "Your available studies" : "You’re all caught up."}
          </h3>
          <p className="overview-muted mt-3 text-sm leading-6">
            {!groups.active.length ? "There’s nothing open right now. Check below for what’s next." : participationError ? "Open View all studies below to see studies and check your participation." : "You’ve completed every study currently open. Thank you for taking part."}
          </p>
        </>}
      </section>
      <section aria-labelledby="upcoming-heading" className="overview-upcoming">
        <span aria-hidden className="overview-upcoming-icon">↗</span>
        <div className="min-w-0">
          <h2 id="upcoming-heading" className="text-xs font-semibold uppercase tracking-[0.12em]">Coming up next</h2>
          {next ? <div className="mt-2 space-y-1">
            <h3 className="font-semibold">Study {next.id}</h3>
            {timing(next, true)}
            <p className="overview-muted text-xs leading-5">You can take part once it opens.</p>
          </div> : <p className="overview-muted mt-2 text-sm">No upcoming studies scheduled yet.</p>}
        </div>
      </section>
      <details className="overview-all px-2 py-1">
        <summary className="overview-link cursor-pointer py-2 text-center font-semibold">View all studies</summary>
        <div className="mt-5 space-y-7">
          <section aria-labelledby="all-active"><h2 id="all-active" className="font-semibold">Available now</h2>{studyList(groups.active, "active")}</section>
          <section aria-labelledby="all-upcoming"><h2 id="all-upcoming" className="font-semibold">Upcoming</h2>{studyList(groups.upcoming, "upcoming")}</section>
          <section aria-labelledby="all-closed"><h2 id="all-closed" className="font-semibold">Recently closed</h2>
            <p className="overview-muted mt-1 text-xs">Studies that closed in the past 30 days.</p>
            {studyList(groups.closed, "closed")}
          </section>
        </div>
      </details>
    </>}
    <footer className="space-y-4 pb-3 text-center text-sm">
      <div className="mx-auto max-w-sm space-y-1">
        <Link href="/settings" prefetch={false} className="overview-reminder inline-block rounded-lg px-3 py-2 text-xs font-medium underline">Reminder preferences</Link>
        <p className="overview-muted text-xs leading-5">Optional reminders concern active studies you haven’t finished.</p>
      </div>
      <div className="overview-progress mx-auto max-w-sm pt-4">
        <svg aria-hidden="true" focusable="false" viewBox="0 0 32 32" className="overview-sprout mx-auto mb-2 h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 27V15M16 20C8 20 5 15 5 10c7 0 11 3 11 10ZM16 16C16 9 21 5 27 5c0 7-4 11-11 11ZM10 27h12" />
        </svg>
      <p className="font-semibold">{participationError ? "Your completion count is unavailable." : `${completedCount} ${completedCount === 1 ? "study" : "studies"} completed`}</p>
      <div aria-hidden className="overview-progress-track"><span /><span /><span /></div>
      <p className="overview-muted mt-2 text-xs leading-5">Thanks for contributing to humor research.</p>
      </div>
    </footer>
  </div>;
}
