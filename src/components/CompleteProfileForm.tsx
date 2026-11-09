import { signOut, updateProfileName } from "@/app/profile-actions";
import { ThemeMenu } from "@/components/theme/ThemeMenu";
import { SubmitButton } from "./SubmitButton";

export function CompleteProfileForm({
  initialFirst,
  initialLast,
  message,
  nextPath = "/",
  userEmail,
}: {
  initialFirst: string;
  initialLast: string;
  message?: string | null;
  nextPath?: string;
  userEmail: string | undefined | null;
}) {
  return (
    <div
      id="profile-complete-root"
      className="participant-theme relative flex h-[100svh] min-h-[100svh] items-start justify-center overflow-hidden px-4 pt-8 pb-24 text-[var(--foreground)] sm:items-center sm:px-6 sm:pt-10"
    >
      <div
        id="profile-complete-card"
        className="participant-panel relative max-h-[calc(100svh-9rem)] w-full max-w-2xl overflow-y-auto rounded-3xl border border-[var(--panel-border)] bg-[var(--card-surface)] p-8 shadow-[var(--panel-shadow)] sm:p-10"
      >
        <div id="profile-card-body" className="relative space-y-7">
          <header className="space-y-2">
            <p className="text-sm uppercase tracking-[0.2em] text-[var(--soft)]">
              Welcome
            </p>
            <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">
              <span className="text-[var(--foreground)]">
                Tell us who you are
              </span>
            </h1>
            <p className="text-sm text-[var(--muted)] sm:text-base">
              We need your first and last name before you can enter. You&apos;re
              signed in as {userEmail ?? "your account"}.
            </p>
            {message ? (
              <p className="rounded-xl bg-[color-mix(in_srgb,_var(--accent)_12%,_transparent)] px-4 py-3 text-sm font-medium text-[var(--foreground)] ring-1 ring-[color-mix(in_srgb,_var(--accent)_35%,_transparent)]">
                {message}
              </p>
            ) : null}
          </header>

          <form id="profile-name-form" action={updateProfileName} className="space-y-4">
            <input type="hidden" name="next" value={nextPath} />
            <div id="profile-name-grid" className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-semibold text-[var(--foreground)]">
                First name
                <input
                  name="first_name"
                  defaultValue={initialFirst}
                  required
                  minLength={2}
                  className="mt-2 w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-3 text-base text-[var(--foreground)] outline-none ring-1 ring-[var(--input-border)] transition focus:ring-2 focus:ring-[var(--input-ring)]"
                  placeholder="Jane"
                />
              </label>
              <label className="block text-sm font-semibold text-[var(--foreground)]">
                Last name
                <input
                  name="last_name"
                  defaultValue={initialLast}
                  required
                  minLength={2}
                  className="mt-2 w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-3 text-base text-[var(--foreground)] outline-none ring-1 ring-[var(--input-border)] transition focus:ring-2 focus:ring-[var(--input-ring)]"
                  placeholder="Doe"
                />
              </label>
            </div>
            <div
              id="profile-action-row"
              className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end"
            >
              <SubmitButton
                formAction={updateProfileName}
                pendingLabel="Saving…"
                className="participant-primary w-full rounded-xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[var(--accent-contrast)] transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-strong)] sm:w-auto"
              >
                Save and continue
              </SubmitButton>
              <SubmitButton
                pendingLabel="Signing out…"
                formAction={signOut}
                formNoValidate
                className="w-full rounded-xl border border-[var(--panel-border)] bg-[var(--surface-muted)] px-5 py-3 text-sm font-semibold text-[var(--foreground)] transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--panel-border)] sm:w-auto"
              >
                Log out
              </SubmitButton>
            </div>
          </form>
        </div>
      </div>
      <ThemeMenu />
    </div>
  );
}
