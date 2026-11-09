import Link from "next/link";
import { StudyIllustration } from "@/components/StudyIllustration";
import { StudyTiming } from "@/components/StudyTiming";
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

  return <div className="overview-composition">
    <header className="overview-header">
      <p className="overview-brand">FunnyStudy</p>
      <div className="overview-greeting">
        <p className="overview-greeting-name">Hi, {firstName}</p>
        <h1>Ready for your next study?</h1>
      </div>
    </header>
    {studyError ? <section role="alert" className="overview-message overview-message-error">
      <h2 className="text-xl font-semibold">We couldn&apos;t load studies</h2>
      <p className="overview-muted mt-3">Please refresh and try again.</p>
      <form action="/" method="get"><button type="submit" className="overview-link mt-4 inline-block cursor-pointer font-semibold">Try again</button></form>
    </section> : <>
      {participationError ? <p role="alert" className="overview-message text-sm">
        We couldn&apos;t load your study completion status. Please refresh to try again.
      </p> : null}
      <section aria-labelledby="available-heading" className={`overview-feature ${featured ? "overview-feature-active" : "overview-feature-empty"} `}>
        <div className="overview-feature-content">
          <h2 id="available-heading" className="overview-label">Available now</h2>
        {featured ? <>
          <h3 className="overview-study-title">Study {featured.id}</h3>
          <div className="overview-feature-timing"><StudyTiming study={featured} /></div>
          <Link prefetch={false} href={`/study/${featured.id}`} className="overview-button">
            {byStudy.get(featured.id)?.started_at ? "Continue Study" : "Start Study"} <span aria-hidden className="ml-3">→</span>
          </Link>
        </> : <>
          <h3 className="overview-state-title">
            {!groups.active.length ? "No active studies" : participationError ? "Your available studies" : "You’re all caught up."}
          </h3>
          <p className="overview-muted overview-state-copy">
            {!groups.active.length ? "There’s nothing open right now. Check below for what’s next." : participationError ? "Visit View all studies to see studies and check your participation." : "You’ve completed every study currently open. Thank you for taking part."}
          </p>
        </>}
        </div>
        <div className="overview-feature-art"><StudyIllustration /></div>
      </section>
      <section aria-labelledby="upcoming-heading" className="overview-next">
        <h2 id="upcoming-heading" className="overview-next-heading">Coming up next</h2>
        <div className="overview-upcoming">
          <svg aria-hidden="true" focusable="false" className="overview-upcoming-mark" width="24" height="24" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 6h23v17H16l-8 6v-6H5Zm5 6h13m-13 5h8" />
          </svg>
          <div className="min-w-0">
            {next ? <>
              <h3 className="font-semibold">Study {next.id}</h3>
              <StudyTiming study={next} upcoming />
              <p className="overview-muted text-xs leading-5">You can take part once it opens.</p>
            </> : <p className="overview-muted">No upcoming studies scheduled yet.</p>}
          </div>
        </div>
      </section>
      <nav className="overview-all" aria-label="Studies">
        <Link href="/studies" prefetch={false} className="overview-all-link">View all studies <span aria-hidden>→</span></Link>
      </nav>
    </>}
    <footer className="overview-footer">
      <div className="overview-progress">
        <StudyIllustration variant="sprout" />
        <div className="overview-progress-copy"><p className="overview-completion-count">{participationError ? "Your completion count is unavailable." : `${completedCount} ${completedCount === 1 ? "study" : "studies"} completed`}</p>
        <p className="overview-muted">Thanks for contributing to humor research.</p></div>
      </div>
      <div className="overview-utilities">
        <Link href="/settings" prefetch={false} className="overview-reminder">
          <svg aria-hidden="true" focusable="false" width="24" height="24" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 13a7 7 0 0 1 14 0c0 8 3 8 3 10H6c0-2 3-2 3-10Zm4 14h6M16 4v2" />
          </svg>
          <span className="overview-reminder-text">
            <span className="overview-reminder-title">Reminder preferences</span>
            <br />
            <span className="overview-reminder-copy">Manage optional study reminders</span>
          </span>
          <span aria-hidden="true" className="overview-reminder-arrow">→</span>
        </Link>
      </div>
    </footer>
  </div>;
}
