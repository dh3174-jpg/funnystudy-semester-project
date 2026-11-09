import type { SupabaseClient } from "@supabase/supabase-js";
import type { Tables } from "@/types/supabase";

export type StudyParticipation = Tables<"study_participations">;

export function isStudyCompleted(participation?: StudyParticipation | null) {
  return Boolean(participation?.started_at && participation.ended_at);
}

export async function fetchStudyParticipations(
  supabase: SupabaseClient,
  profileId: string,
  studyIds: number[]
) {
  if (studyIds.length === 0) return { participations: [], error: null };

  const { data, error } = await supabase
    .from("study_participations")
    .select("profile_id, study_id, started_at, ended_at, completion_stats")
    .eq("profile_id", profileId)
    .in("study_id", studyIds);

  return { participations: (data ?? []) as StudyParticipation[], error };
}


// Read every page so the completion total includes older studies without a row-limit truncation.
export async function fetchDashboardParticipations(supabase: SupabaseClient, profileId: string) {
  const participations: StudyParticipation[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.from("study_participations")
      .select("profile_id, study_id, started_at, ended_at, completion_stats")
      .eq("profile_id", profileId)
      .order("study_id", { ascending: true })
      .range(offset, offset + 999);
    if (error) return { participations: [], error };
    participations.push(...(data ?? []) as StudyParticipation[]);
    if (!data || data.length < 1000) return { participations, error: null };
  }
}

export function selectFeaturedStudy(
  active: import("./studies").StudyRow[],
  participations: StudyParticipation[]
) {
  const byStudy = new Map(participations.map((row) => [row.study_id, row]));
  // The dashboard's active queue is already ordered by nearest closing time.
  const unfinished = active.filter((study) => !isStudyCompleted(byStudy.get(study.id)));
  return unfinished.find((study) => byStudy.get(study.id)?.started_at) ?? unfinished[0] ?? null;
}
