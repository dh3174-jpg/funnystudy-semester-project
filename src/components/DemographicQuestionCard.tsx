"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUturnLeftIcon } from "@heroicons/react/24/solid";

import { saveDemographicQuestionAnswerSelection } from "@/app/demographics/actions";
import type { DemographicQuestion } from "@/lib/demographics";
import { DEMOGRAPHIC_SKIPS_COOKIE, encodeDemographicSkips } from "@/lib/demographic-skips";

const PREVIOUS_WINDOW_MS = 3600;

type PendingAnswer = {
  answerSelection: string;
  isLastQuestion: boolean;
  questionId: string;
  questionIndex: number;
  timeoutId: number;
};

type PreviousState = {
  questionIndex: number;
  selectedValue: string;
} | null;

export function DemographicQuestionCard({
  message,
  next,
  profileId,
  questions,
  skipped,
}: {
  message?: string | null;
  next: string;
  profileId: string;
  questions: readonly DemographicQuestion[];
  skipped: readonly string[];
}) {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedValues, setSelectedValues] = useState<Record<string, string>>(
    {}
  );
  const [previousState, setPreviousState] = useState<PreviousState>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [answerSearch, setAnswerSearch] = useState("");
  const pendingSaveCountRef = useRef(0);
  const pendingAnswersRef = useRef(new Map<number, PendingAnswer>());
  const skippedRef = useRef<string[]>([...skipped]);
  const finishedRef = useRef(false);
  const redirectPathRef = useRef<string | null>(null);
  const question = questions[currentIndex] ?? null;
  const remaining = Math.max(questions.length - currentIndex, 0);
  const remainingLabel = useMemo(
    () => `${remaining.toLocaleString("en-US")} remaining`,
    [remaining]
  );
  const hasManyAnswers = (question?.options.length ?? 0) > 10;
  const visibleOptions = useMemo(() => {
    if (!question) {
      return [];
    }

    const query = answerSearch.trim().toLowerCase();

    if (!hasManyAnswers || !query) {
      return question.options;
    }

    return question.options.filter((option) =>
      option.label.toLowerCase().includes(query)
    );
  }, [answerSearch, hasManyAnswers, question]);

  const updatePendingSaveCount = useCallback((nextCount: number) => {
    pendingSaveCountRef.current = Math.max(0, nextCount);
  }, []);

  const canFinish = useCallback(
    () =>
      finishedRef.current &&
      pendingAnswersRef.current.size === 0 &&
      pendingSaveCountRef.current === 0 &&
      redirectPathRef.current,
    []
  );

  const finishIfReady = useCallback(() => {
    const redirectPath = canFinish();

    if (redirectPath) {
      router.push(redirectPath);
    }
  }, [canFinish, router]);

  const saveAnswer = useCallback(
    async (pendingAnswer: Omit<PendingAnswer, "timeoutId">) => {
      updatePendingSaveCount(pendingSaveCountRef.current + 1);

      let result;
      try {
        result = await saveDemographicQuestionAnswerSelection({
          answerSelection: pendingAnswer.answerSelection,
          next,
          questionId: pendingAnswer.questionId,
          skippedQuestionIds: skippedRef.current,
        });
      } catch {
        result = { success: false as const, error: "We could not save that answer. Try again." };
      }

      updatePendingSaveCount(pendingSaveCountRef.current - 1);

      if (!result.success) {
        setSaveError(result.error);
        finishedRef.current = false;
        setAnswerSearch("");
        setCurrentIndex(pendingAnswer.questionIndex);
        return;
      }

      if (pendingAnswer.isLastQuestion) {
        redirectPathRef.current = result.redirectPath;
      }

      finishIfReady();
    },
    [finishIfReady, next, updatePendingSaveCount]
  );

  const clearPendingAnswer = useCallback((questionIndex: number) => {
    const pendingAnswer = pendingAnswersRef.current.get(questionIndex);

    if (!pendingAnswer) {
      return null;
    }

    window.clearTimeout(pendingAnswer.timeoutId);
    pendingAnswersRef.current.delete(questionIndex);
    return pendingAnswer;
  }, []);

  const commitPendingAnswer = useCallback(
    (pendingAnswer: PendingAnswer) => {
      window.clearTimeout(pendingAnswer.timeoutId);
      pendingAnswersRef.current.delete(pendingAnswer.questionIndex);
      setPreviousState((current) =>
        current?.questionIndex === pendingAnswer.questionIndex ? null : current
      );
      void saveAnswer(pendingAnswer);
    },
    [saveAnswer]
  );

  const commitPendingAnswersExcept = useCallback(
    (questionIndex: number | null = null) => {
      for (const pendingAnswer of pendingAnswersRef.current.values()) {
        if (pendingAnswer.questionIndex !== questionIndex) {
          commitPendingAnswer(pendingAnswer);
        }
      }
    },
    [commitPendingAnswer]
  );

  const scheduleSave = useCallback(
    (pendingAnswer: Omit<PendingAnswer, "timeoutId">) => {
      clearPendingAnswer(pendingAnswer.questionIndex);
      commitPendingAnswersExcept(pendingAnswer.questionIndex);

      const timeoutId = window.setTimeout(() => {
        pendingAnswersRef.current.delete(pendingAnswer.questionIndex);
        setPreviousState((current) =>
          current?.questionIndex === pendingAnswer.questionIndex ? null : current
        );
        void saveAnswer(pendingAnswer);
      }, PREVIOUS_WINDOW_MS);

      pendingAnswersRef.current.set(pendingAnswer.questionIndex, {
        ...pendingAnswer,
        timeoutId,
      });
    },
    [clearPendingAnswer, commitPendingAnswersExcept, saveAnswer]
  );

  const goForward = useCallback(
    (questionIndex: number) => {
      if (questionIndex >= questions.length - 1) {
        finishedRef.current = true;
        setCurrentIndex(questions.length);
        // The final response needs no artificial undo delay before leaving.
        commitPendingAnswersExcept();
        return;
      }

      setCurrentIndex(questionIndex + 1);
    },
    [commitPendingAnswersExcept, questions.length]
  );

  const answerQuestion = useCallback(
    (answerSelection: string) => {
      if (!question) {
        return;
      }

      const questionIndex = currentIndex;
      const isLastQuestion = questionIndex >= questions.length - 1;

      setSaveError(null);
      setSelectedValues((current) => ({
        ...current,
        [question.id]: answerSelection,
      }));
      setAnswerSearch("");
      scheduleSave({
        answerSelection,
        isLastQuestion,
        questionId: question.id,
        questionIndex,
      });
      setPreviousState({ questionIndex, selectedValue: answerSelection });
      goForward(questionIndex);
    },
    [currentIndex, goForward, question, questions.length, scheduleSave]
  );

  const goBackToPrevious = useCallback(() => {
    if (!previousState) {
      return;
    }

    clearPendingAnswer(previousState.questionIndex);
    finishedRef.current = false;
    redirectPathRef.current = null;
    setAnswerSearch("");
    setCurrentIndex(previousState.questionIndex);
    setPreviousState(null);
  }, [clearPendingAnswer, previousState]);

  const skipQuestions = useCallback((skipRemaining: boolean) => {
    if (!question) return;

    const questionIds = skipRemaining
      ? questions.slice(currentIndex).map(({ id }) => id)
      : [question.id];
    skippedRef.current = [...new Set([...skippedRef.current, ...questionIds])];
    // Session-only, user-scoped skips never create database responses.
    document.cookie = `${DEMOGRAPHIC_SKIPS_COOKIE}=${encodeDemographicSkips(profileId, skippedRef.current)}; Path=/; SameSite=Lax${window.location.protocol === "https:" ? "; Secure" : ""}`;
    setSaveError(null);
    setPreviousState(null);
    setAnswerSearch("");

    if (skipRemaining || currentIndex >= questions.length - 1) {
      finishedRef.current = true;
      redirectPathRef.current = next;
      setCurrentIndex(questions.length);
    } else {
      goForward(currentIndex);
    }
    // Keep selected responses, including the latest undoable answer, before leaving.
    commitPendingAnswersExcept();
    finishIfReady();
  }, [commitPendingAnswersExcept, currentIndex, finishIfReady, goForward, next, profileId, question, questions]);


  useEffect(() => {
    const pendingAnswers = pendingAnswersRef.current;

    return () => {
      for (const pendingAnswer of pendingAnswers.values()) {
        window.clearTimeout(pendingAnswer.timeoutId);
      }
    };
  }, []);

  if (!question) {
    return (
      <section
        className="participant-transition w-full px-6 py-8 text-center sm:px-8"
      >
        <div role="status" aria-live="polite" aria-busy="true" className="mx-auto max-w-sm space-y-5 py-6">
          <span aria-hidden className="mx-auto block h-6 w-6 rounded-full border-2 border-[var(--panel-border)] border-t-[var(--accent-strong)] participant-spinner" />
          <h1 className="text-2xl font-semibold tracking-tight">Saving your responses...</h1>
          <p className="text-sm text-[var(--muted)]">We’ll take you back as soon as your responses are saved.</p>
        </div>
      </section>
    );
  }

  return (
    <section
      className="participant-panel w-full rounded-2xl p-6 sm:p-8"
    >
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--soft)]">
            Participant Demographic Survey
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]"><span className="participant-badge mr-2">Optional</span>Answer what you’re comfortable sharing, or skip the remaining survey.</p>
          <h1 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">
            {question.prompt}
          </h1>
        </div>
        <span className="shrink-0 rounded-full bg-[var(--surface-muted)] px-3 py-1.5 text-xs font-semibold text-[var(--muted)] ring-1 ring-[var(--panel-border)] sm:mt-1">
          {remainingLabel}
        </span>
      </div>

      {question.description ? (
        <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
          {question.description}
        </p>
      ) : null}

      {message || saveError ? (
        <p role="alert" className="mt-5 rounded-lg bg-[color-mix(in_srgb,_var(--accent)_12%,_transparent)] px-4 py-3 text-sm font-medium text-[var(--foreground)] ring-1 ring-[color-mix(in_srgb,_var(--accent)_35%,_transparent)]">
          {saveError ?? message}
        </p>
      ) : null}

      <div className="mt-7">
        {hasManyAnswers ? (
          <label className="mb-3 block text-sm font-semibold text-[var(--foreground)]">
            Search answers
            <input
              type="search"
              value={answerSearch}
              onChange={(event) => setAnswerSearch(event.target.value)}
              className="mt-2 w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-3 text-base text-[var(--foreground)] outline-none transition focus:ring-2 focus:ring-[var(--input-ring)]"
              placeholder="Type to filter"
            />
          </label>
        ) : null}
      </div>

      <div
        className={
          hasManyAnswers
            ? "mt-3 max-h-80 overflow-y-auto px-1 pt-1"
            : ""
        }
        data-native-scroll-region={hasManyAnswers ? "true" : undefined}
      >
        <div className="grid gap-3">
          {visibleOptions.map((option) => {
            const value = `${option.mappingId}::${option.id}`;
            const isSelected = selectedValues[question.id] === value;

            return (
              <button
                key={option.mappingId}
                type="button"
                aria-pressed={isSelected}
                className={`participant-option flex min-h-12 w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-medium ${isSelected ? "participant-option-selected" : ""}`}
                onClick={() => answerQuestion(value)}
              >
                <span
                  aria-hidden
                  className={`participant-radio h-4 w-4 shrink-0 rounded-full border ${isSelected ? "participant-radio-selected" : ""}`}
                />
                <span>{option.label}</span>
              </button>
            );
          })}
          {hasManyAnswers && !visibleOptions.length ? (
            <p className="rounded-lg border border-[var(--input-border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--muted)]">
              No matching answers.
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--panel-border)] pt-5">
        <div className="flex min-h-9 items-center">
          {previousState ? (
            <PreviousButton
              previousState={previousState}
              onPrevious={goBackToPrevious}
            />
          ) : (
            <span aria-hidden />
          )}
        </div>
        <button
          type="button"
          className="participant-secondary rounded-xl px-5 py-3 text-sm font-semibold"
          onClick={() => skipQuestions(false)}
        >
          Skip for now
        </button>
      </div>
      <button
        type="button"
        onClick={() => skipQuestions(true)}
        className="participant-skip mt-4 w-full rounded-xl px-3 py-3 text-sm font-semibold underline underline-offset-4"
      >
        Skip remaining survey
      </button>
    </section>
  );
}

function PreviousButton({
  onPrevious,
  previousState,
}: {
  onPrevious: () => void;
  previousState: PreviousState;
}) {
  if (!previousState) {
    return null;
  }

  return (
    <div className="flex justify-start">
      <div
        key={previousState.questionIndex}
        className="demographic-previous-affordance pointer-events-auto flex items-center gap-2"
        style={{ animationDuration: `${PREVIOUS_WINDOW_MS}ms` }}
      >
        <button
          type="button"
          aria-label="Go back to previous question"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--panel-border)] bg-[var(--surface-muted)] text-[var(--foreground)] transition hover:-translate-x-0.5 hover:border-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-strong)]"
          onClick={onPrevious}
        >
          <ArrowUturnLeftIcon className="h-5 w-5" aria-hidden />
        </button>
        <span className="text-xs text-[var(--soft)]">
          Back to change your last answer
        </span>
      </div>
    </div>
  );
}
