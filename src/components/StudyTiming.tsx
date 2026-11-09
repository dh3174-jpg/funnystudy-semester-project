import { LocalDateTime } from "@/components/LocalDateTime";
import type { StudyRow } from "@/lib/studies";

export function StudyTiming({ study, upcoming = false }: { study: StudyRow; upcoming?: boolean }) {
  const value = upcoming ? study.start_datetime_utc : study.end_datetime_utc;
  return <p className="overview-muted text-sm leading-6">
    {value ? <>{upcoming ? "Opens " : "Closes "}<LocalDateTime value={value} /></> : "No end date"}
  </p>;
}
