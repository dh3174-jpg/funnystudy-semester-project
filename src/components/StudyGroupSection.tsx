import Link from "next/link";
import { LocalDateTime } from "@/components/LocalDateTime";
import { StudyTiming } from "@/components/StudyTiming";
import type { StudyRow } from "@/lib/studies";
import { isStudyCompleted, type StudyParticipation } from "@/lib/study-participation";

export function StudyGroupSection({ items, kind, participations, participationError }: {
  items: StudyRow[];
  kind: "active" | "upcoming" | "closed";
  participations: StudyParticipation[];
  participationError: boolean;
}) {
  const byStudy = new Map(participations.map(row => [row.study_id, row]));
  const heading = kind === "active" ? "Available now" : kind === "upcoming" ? "Upcoming" : "Recently closed";
  function rows() {
    if (!items.length) return <p className="studies-empty overview-muted">
      {kind === "active" ? "No active studies right now." : kind === "upcoming" ? "No upcoming studies scheduled yet." : "No studies closed in the past 30 days."}
    </p>;
    return <ul className="divide-y divide-[var(--participant-border)]">
      {items.map((study) => {
        const participation = byStudy.get(study.id);
        const completed = !participationError && isStudyCompleted(participation);
        const canOpen = completed || kind === "active";
        return <li key={study.id} className="studies-row">
          <div className="studies-row-heading">
            <h3 className="font-semibold">Study {study.id}</h3>
            <span className="studies-status">
              {kind === "closed" ? "Closed" : kind === "upcoming" ? "Upcoming" : "Available now"}
              {completed ? " · Completed" : !participationError && participation?.started_at ? " · In progress" : ""}
            </span>
          </div>
          {kind === "closed" ? <p className="overview-muted text-sm leading-6">
            Closed <LocalDateTime value={study.end_datetime_utc!} />.
            {completed ? " Thanks for taking part." : " Participation is no longer available."}
          </p> : <StudyTiming study={study} upcoming={kind === "upcoming"} />}
          {canOpen ? <Link prefetch={false} href={`/study/${study.id}`} className={`overview-link studies-action ${kind === "active" && !completed && !participationError ? "studies-action-primary" : ""}`}>
            {completed ? "View study stats" : participationError ? "View study" : participation?.started_at ? "Continue Study" : "Start Study"} <span aria-hidden>→</span>
          </Link> : null}
        </li>;
      })}
    </ul>;

  }
  return <section className={`studies-group studies-group-${kind}`} aria-labelledby={`studies-${kind}`}>
    <h2 id={`studies-${kind}`}>{heading}</h2>
    <div className="studies-group-body">
    {kind === "closed" ? <p className="overview-muted studies-section-note">Studies that closed in the past 30 days.</p> : null}
    {rows()}
    </div>
  </section>;
}
