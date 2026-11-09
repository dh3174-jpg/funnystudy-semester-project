import { ThemeMenu } from "@/components/theme/ThemeMenu";
import { GoogleSignInForm } from "@/components/GoogleSignInForm";
import { normalizeRelativePath } from "@/lib/url";
import { PolicyLinks } from "@/components/PolicyLinks";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { message, redirectedFrom } = await searchParams;
  const next = normalizeRelativePath(redirectedFrom);
  const displayMessage = Array.isArray(message) ? message[0] : message;

  return (
    <div className="participant-theme relative flex h-[100svh] flex-col overflow-hidden px-0 text-[var(--foreground)]">
      <main className="relative mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col overflow-y-auto overscroll-contain px-5 pt-12 pb-24 sm:px-8">
        <div className="participant-panel relative my-auto w-full max-w-lg shrink-0 self-center overflow-hidden rounded-2xl px-8 py-9  sm:px-10 sm:py-11">
          <div className="space-y-8">
            <div className="space-y-4 text-center">
              <p className="participant-wordmark">
                FunnyStudy <span aria-hidden>✳</span>
              </p>
              <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">
                Welcome back
              </h1>
              <p className="text-sm text-[var(--muted)] sm:text-base">
                A little humor. A contribution to research.
              </p>
              {displayMessage ? (
                <p className="rounded-xl bg-[color-mix(in_srgb,_var(--accent)_12%,_transparent)] px-4 py-3 text-sm font-semibold text-[var(--foreground)] ring-1 ring-[color-mix(in_srgb,_var(--accent)_35%,_transparent)]">
                  {displayMessage}
                </p>
              ) : null}
            </div>

            <GoogleSignInForm next={next} icon={<GoogleIcon />} />
            <p className="text-sm text-[var(--muted)]"><PolicyLinks /></p>
          </div>
        </div>
      </main>
      <ThemeMenu />
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg
      className="h-5 w-5"
      aria-hidden
      viewBox="0 0 24 24"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M21.35 11.1h-9.17v2.92h5.32c-.24 1.36-1.44 4-5.32 4-3.2 0-5.81-2.66-5.81-5.94 0-3.28 2.61-5.94 5.81-5.94 1.82 0 3.04.77 3.74 1.44l2.55-2.46C16.94 3.5 14.75 2.5 12 2.5 6.98 2.5 3 6.48 3 11.5S6.98 20.5 12 20.5c6.15 0 8.5-4.33 8.5-7.41 0-.5-.05-.89-.15-1.99Z"
      />
    </svg>
  );
}
