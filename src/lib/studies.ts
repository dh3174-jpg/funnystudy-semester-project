import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { shuffleStudyCaptionIds, STUDY_CAPTION_BATCH_SIZE } from "@/lib/study-caption-order";

const INITIAL_ACTIVE_STUDY_CAPTION_COUNT = 60;

type StudyCaptionMappingRow = {
  id: number;
  caption_id: string | null;
};

export type ActiveStudyCaption = {
  id: string;
  content: string | null;
  created_datetime_utc: string | null;
  image_id: string | null;
  like_count: number | null;
  study_caption_mapping_id: number | null;
  images:
    | {
        url: string | null;
      }
    | {
        url: string | null;
      }[]
    | null;
};

type StudyCaptionRow = Omit<ActiveStudyCaption, "study_caption_mapping_id">;

type StudyCaptionMappingWithCaptionRow = StudyCaptionMappingRow & {
  captions: StudyCaptionRow | StudyCaptionRow[] | null;
};

type CaptionIdRow = {
  caption_id: string;
};

type CaptionSaveRow = {
  caption_id: string;
};

export type StudyRow = {
  description: string | null;
  end_datetime_utc: string | null;
  id: number;
  is_private: boolean | null;
  slug: string | null;
  start_datetime_utc: string | null;
};

export type ViewerActiveStudyCaption = ActiveStudyCaption & {
  is_liked: boolean;
  is_saved: boolean;
};

export type NumericStudyLookupResult =
  | { error: null; status: "active"; study: StudyRow }
  | { error: null; status: "expired"; study: StudyRow }
  | { error: null; status: "missing"; study: null }
  | { error: PostgrestError; status: "error"; study: null };

type StudyCaptionScope = {
  includePrivateStudies?: boolean;
  studyId?: number | null;
};

function normalizeStudyId(studyId: number | null | undefined) {
  return typeof studyId === "number" &&
    Number.isSafeInteger(studyId) &&
    studyId > 0
    ? studyId
    : null;
}

function isStudyInActiveDateRange(study: StudyRow, now: Date) {
  const nowTime = now.getTime();
  const startTime = study.start_datetime_utc
    ? new Date(study.start_datetime_utc).getTime()
    : null;
  const endTime = study.end_datetime_utc
    ? new Date(study.end_datetime_utc).getTime()
    : null;

  return (
    (startTime === null || startTime <= nowTime) &&
    (endTime === null || endTime >= nowTime)
  );
}

export async function resolveNumericStudy(
  supabase: SupabaseClient,
  studyId: number,
  now = new Date()
): Promise<NumericStudyLookupResult> {
  const normalizedStudyId = normalizeStudyId(studyId);

  if (normalizedStudyId === null) {
    return { error: null, status: "missing", study: null };
  }

  const { data, error } = await supabase
    .from("studies")
    .select("id, slug, description, is_private, start_datetime_utc, end_datetime_utc")
    .eq("id", normalizedStudyId)
    .maybeSingle();

  if (error) {
    return { error, status: "error", study: null };
  }

  const study = data as StudyRow | null;

  if (!study) {
    return { error: null, status: "missing", study: null };
  }

  if (!isStudyInActiveDateRange(study, now)) {
    return { error: null, status: "expired", study };
  }

  return { error: null, status: "active", study };
}

export async function fetchPublicActiveStudyIdentities(
  supabase: SupabaseClient,
  now = new Date()
): Promise<{ error: PostgrestError | null; studies: StudyRow[] }> {
  const nowIso = now.toISOString();
  const { data, error } = await supabase
    .from("studies")
    .select("id, slug, description, is_private, start_datetime_utc, end_datetime_utc")
    .or(`start_datetime_utc.lte.${nowIso},start_datetime_utc.is.null`)
    .or(`end_datetime_utc.gte.${nowIso},end_datetime_utc.is.null`)
    .eq("is_private", false)
    .order("id", { ascending: true });

  if (error) {
    return { error, studies: [] };
  }

  return { error: null, studies: (data ?? []) as StudyRow[] };
}

/** Dashboard metadata only; caption access keeps its existing active-window checks. */
export async function fetchPublicStudyOverview(supabase: SupabaseClient, now = new Date()) {
  const studies: StudyRow[] = [];
  const cutoff = new Date(now.getTime() - 30 * 86_400_000).toISOString();
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.from("studies")
      .select("id, slug, description, is_private, start_datetime_utc, end_datetime_utc")
      .eq("is_private", false)
      .or(`end_datetime_utc.gte.${cutoff},end_datetime_utc.is.null`)
      .order("id", { ascending: true })
      .range(offset, offset + 999);
    if (error) return { studies: [], error };
    studies.push(...(data ?? []) as StudyRow[]);
    if (!data || data.length < 1000) return { studies, error: null };
  }
}

export function groupDashboardStudies(studies: StudyRow[], now: Date) {
  const active: StudyRow[] = [], upcoming: StudyRow[] = [], closed: StudyRow[] = [];
  const time = now.getTime();
  for (const study of studies) {
    if (study.is_private !== false) continue;
    const start = study.start_datetime_utc === null ? -Infinity : Date.parse(study.start_datetime_utc);
    const end = study.end_datetime_utc === null ? Infinity : Date.parse(study.end_datetime_utc);
    if (Number.isNaN(start) || Number.isNaN(end) || start > end) continue;
    if (start <= time && end >= time) active.push(study);
    else if (start > time) upcoming.push(study);
    else if (end < time && end >= time - 30 * 86_400_000) closed.push(study);
  }
  const closingTime = (study: StudyRow) => study.end_datetime_utc ? Date.parse(study.end_datetime_utc) : Infinity;
  active.sort((a, b) => closingTime(a) - closingTime(b) || a.id - b.id);
  upcoming.sort((a, b) => Date.parse(a.start_datetime_utc!) - Date.parse(b.start_datetime_utc!) || a.id - b.id);
  closed.sort((a, b) => Date.parse(b.end_datetime_utc!) - Date.parse(a.end_datetime_utc!) || a.id - b.id);
  return { active, upcoming, closed };
}

async function fetchSavedCaptionIdsForProfile(
  supabase: SupabaseClient,
  profileId: string,
  captionIds: readonly string[]
): Promise<{ savedCaptionIds: Set<string>; error: PostgrestError | null }> {
  if (!captionIds.length) {
    return { savedCaptionIds: new Set<string>(), error: null };
  }

  const { data, error } = await supabase
    .from("caption_saves")
    .select("caption_id")
    .eq("profile_id", profileId)
    .in("caption_id", captionIds);

  if (error) {
    return { savedCaptionIds: new Set<string>(), error };
  }

  return {
    savedCaptionIds: new Set(
      ((data ?? []) as CaptionSaveRow[]).map((row) => row.caption_id)
    ),
    error: null,
  };
}

async function fetchLikedCaptionIdsForProfile(
  supabase: SupabaseClient,
  profileId: string,
  captionIds: readonly string[]
): Promise<{ likedCaptionIds: Set<string>; error: PostgrestError | null }> {
  if (!captionIds.length) {
    return { likedCaptionIds: new Set<string>(), error: null };
  }

  const { data, error } = await supabase
    .from("caption_votes")
    .select("caption_id")
    .eq("profile_id", profileId)
    .eq("is_from_study", true)
    .gt("vote_value", 0)
    .in("caption_id", captionIds);

  if (error) {
    return { likedCaptionIds: new Set<string>(), error };
  }

  return {
    likedCaptionIds: new Set(
      ((data ?? []) as CaptionIdRow[]).map((row) => row.caption_id)
    ),
    error: null,
  };
}

export async function fetchActiveStudyCaptionTotalCount(
  supabase: SupabaseClient,
  _profileId: string,
  now = new Date(),
  scope: StudyCaptionScope = {}
): Promise<{ count: number; error: PostgrestError | null }> {
  const { ids: activeCaptionIds, error: activeCaptionIdsError } =
    await fetchActiveStudyCaptionIds(supabase, now, scope);

  if (activeCaptionIdsError) {
    return { count: 0, error: activeCaptionIdsError };
  }

  if (!activeCaptionIds.length) {
    return { count: 0, error: null };
  }
  return {
    count: activeCaptionIds.length,
    error: null,
  };
}

export async function fetchActiveStudyCaptionIds(
  supabase: SupabaseClient,
  now = new Date(),
  scope: StudyCaptionScope = {}
): Promise<{ ids: string[]; error: PostgrestError | null }> {
  const PAGE_SIZE = 1000;
  const nowIso = now.toISOString();
  const normalizedStudyId = normalizeStudyId(scope.studyId);
  const ids = new Set<string>();
  let from = 0;
  let error: PostgrestError | null = null;

  while (true) {
    let query = supabase
      .from("study_caption_mappings")
      .select("id, caption_id, studies!inner(id), captions!inner(id)")
      .or(`start_datetime_utc.lte.${nowIso},start_datetime_utc.is.null`, {
        referencedTable: "studies",
      })
      .or(`end_datetime_utc.gte.${nowIso},end_datetime_utc.is.null`, {
        referencedTable: "studies",
      })
      .order("id", { ascending: true });

    if (!scope.includePrivateStudies) {
      query = query.eq("studies.is_private", false);
    }

    if (normalizedStudyId !== null) {
      query = query.eq("study_id", normalizedStudyId);
    }

    const { data, error: pageError } = await query
      .range(from, from + PAGE_SIZE - 1);

    if (pageError) {
      error = pageError;
      break;
    }

    const rows = (data ?? []) as StudyCaptionMappingRow[];
    rows.forEach((row) => {
      if (typeof row.caption_id === "string" && row.caption_id.length > 0) {
        ids.add(row.caption_id);
      }
    });

    if (rows.length < PAGE_SIZE) {
      break;
    }

    from += PAGE_SIZE;
  }

  return { ids: Array.from(ids), error };
}

export async function fetchActiveStudyCaptions(
  supabase: SupabaseClient,
  now = new Date(),
  scope: StudyCaptionScope = {}
): Promise<{ captions: ActiveStudyCaption[]; error: PostgrestError | null }> {
  const PAGE_SIZE = 1000;
  const nowIso = now.toISOString();
  const normalizedStudyId = normalizeStudyId(scope.studyId);
  const captionsById = new Map<string, ActiveStudyCaption>();
  let from = 0;
  let error: PostgrestError | null = null;

  while (true) {
    let query = supabase
      .from("study_caption_mappings")
      .select(
        "id, caption_id, studies!inner(id), captions!inner(id, content, created_datetime_utc, image_id, like_count, images(url))"
      )
      .or(`start_datetime_utc.lte.${nowIso},start_datetime_utc.is.null`, {
        referencedTable: "studies",
      })
      .or(`end_datetime_utc.gte.${nowIso},end_datetime_utc.is.null`, {
        referencedTable: "studies",
      })
      .order("id", { ascending: true });

    if (!scope.includePrivateStudies) {
      query = query.eq("studies.is_private", false);
    }

    if (normalizedStudyId !== null) {
      query = query.eq("study_id", normalizedStudyId);
    }

    const { data, error: pageError } = await query
      .range(from, from + PAGE_SIZE - 1);

    if (pageError) {
      error = pageError;
      break;
    }

    const rows = (data ?? []) as StudyCaptionMappingWithCaptionRow[];
    rows.forEach((row) => {
      const caption = Array.isArray(row.captions) ? row.captions[0] : row.captions;
      if (!caption?.id) {
        return;
      }

      captionsById.set(caption.id, {
        ...caption,
        study_caption_mapping_id: row.id,
      });
    });

    if (rows.length < PAGE_SIZE) {
      break;
    }

    from += PAGE_SIZE;
  }

  return { captions: Array.from(captionsById.values()), error };
}

export async function fetchActiveStudyCaptionPage(
  supabase: SupabaseClient,
  profileId: string,
  {
    now = new Date(),
    captionIds,
    includePrivateStudies = false,
    studyId = null,
  }: {
    includePrivateStudies?: boolean;
    now?: Date;
    captionIds: readonly string[];
    studyId?: number | null;
  }
): Promise<{
  captions: ViewerActiveStudyCaption[];
  error: PostgrestError | null;
}> {
  const nowIso = now.toISOString();
  const normalizedStudyId = normalizeStudyId(studyId);
  if (!captionIds.length) {
    return { captions: [], error: null };
  }

  const captionsById = new Map<string, ActiveStudyCaption>();
  const mappingPageSize = 1000;
  for (let offset = 0; ; offset += mappingPageSize) {
    let query = supabase
      .from("study_caption_mappings")
      .select(
        "id, caption_id, studies!inner(id), captions!inner(id, content, created_datetime_utc, image_id, like_count, images(url))"
      )
      .in("caption_id", captionIds)
      .or(`start_datetime_utc.lte.${nowIso},start_datetime_utc.is.null`, {
        referencedTable: "studies",
      })
      .or(`end_datetime_utc.gte.${nowIso},end_datetime_utc.is.null`, {
        referencedTable: "studies",
      })
      .order("caption_id", { ascending: true })
      .order("id", { ascending: true });

    if (!includePrivateStudies) {
      query = query.eq("studies.is_private", false);
    }

    if (normalizedStudyId !== null) {
      query = query.eq("study_id", normalizedStudyId);
    }

    const { data, error } = await query.range(offset, offset + mappingPageSize - 1);

    if (error) {
      return { captions: [], error };
    }

    const rows = (data ?? []) as StudyCaptionMappingWithCaptionRow[];

    rows.forEach((row) => {
      const caption = Array.isArray(row.captions) ? row.captions[0] : row.captions;
      if (!caption?.id || captionsById.has(caption.id)) {
        return;
      }

      captionsById.set(caption.id, {
        ...caption,
        study_caption_mapping_id: row.id,
      });
    });

    if (rows.length < mappingPageSize) {
      break;
    }
  }

  // IN queries return database order; restore the order assigned at study entry.
  const candidateCaptions = Array.from(new Set(captionIds)).flatMap((id) => {
    const caption = captionsById.get(id);
    return caption ? [caption] : [];
  });
  const candidateCaptionIds = candidateCaptions.map((caption) => caption.id);

  if (!candidateCaptionIds.length) {
    return {
      captions: [],
      error: null,
    };
  }

  const [
    { likedCaptionIds, error: likedCaptionIdsError },
    { savedCaptionIds, error: savedCaptionIdsError },
  ] = await Promise.all([
    fetchLikedCaptionIdsForProfile(supabase, profileId, candidateCaptionIds),
    fetchSavedCaptionIdsForProfile(supabase, profileId, candidateCaptionIds),
  ]);

  if (likedCaptionIdsError) {
    return { captions: [], error: likedCaptionIdsError };
  }

  if (savedCaptionIdsError) {
    return { captions: [], error: savedCaptionIdsError };
  }

  return {
    captions: candidateCaptions.map((caption) => ({
      ...caption,
      is_liked: likedCaptionIds.has(caption.id),
      is_saved: savedCaptionIds.has(caption.id),
    })),
    error: null,
  };
}

export async function fetchInitialActiveStudyCaptions(
  supabase: SupabaseClient,
  profileId: string,
  {
    includePrivateStudies = false,
    minimumCount = INITIAL_ACTIVE_STUDY_CAPTION_COUNT,
    now = new Date(),
    studyId = null,
  }: {
    includePrivateStudies?: boolean;
    minimumCount?: number;
    now?: Date;
    studyId?: number | null;
  } = {}
): Promise<{
  captionOrder: string[];
  captions: ViewerActiveStudyCaption[];
  error: PostgrestError | null;
  nextOffset: number | null;
}> {
  const normalizedMinimumCount =
    Number.isSafeInteger(minimumCount) && minimumCount > 0
      ? minimumCount
      : INITIAL_ACTIVE_STUDY_CAPTION_COUNT;
  const { ids, error } = await fetchActiveStudyCaptionIds(supabase, now, {
    includePrivateStudies,
    studyId,
  });
  if (error) {
    return { captionOrder: [], captions: [], error, nextOffset: null };
  }

  // Shuffle the entire lightweight ID list once, before fetching any content.
  // Later batches use this snapshot even if mappings change during the run.
  const captionOrder = shuffleStudyCaptionIds(ids);
  const captions: ViewerActiveStudyCaption[] = [];
  let nextOffset: number | null = captionOrder.length ? 0 : null;

  while (nextOffset !== null && captions.length < normalizedMinimumCount) {
    const batchIds = captionOrder.slice(
      nextOffset,
      nextOffset + Math.min(STUDY_CAPTION_BATCH_SIZE, normalizedMinimumCount - captions.length)
    );
    const page = await fetchActiveStudyCaptionPage(supabase, profileId, {
      captionIds: batchIds,
      includePrivateStudies,
      now,
      studyId,
    });

    if (page.error) {
      return {
        captionOrder: [],
        captions: [],
        error: page.error,
        nextOffset: null,
      };
    }

    captions.push(...page.captions);
    const consumedCount: number = nextOffset + batchIds.length;
    nextOffset = consumedCount < captionOrder.length ? consumedCount : null;
  }

  return {
    captionOrder,
    captions,
    error: null,
    nextOffset,
  };
}
