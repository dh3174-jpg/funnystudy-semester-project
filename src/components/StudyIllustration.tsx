/** Decorative, code-native line art; never encodes study or participation state. */
export function StudyIllustration({ variant = "note" }: { variant?: "note" | "sprout" }) {
  if (variant === "sprout") return (
    <svg aria-hidden="true" focusable="false" width="44" height="52" viewBox="0 0 44 52"
      className="overview-illustration overview-illustration-sprout" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path className="overview-leaf-butter" d="M22 29C9 29 4 22 3 13c12-1 19 4 19 16Z" />
      <path className="overview-leaf-pink" d="M22 24C22 12 30 7 41 7c-1 12-7 17-19 17Z" />
      <path d="M22 22v24M9 47c7-3 17-3 26 0" />
    </svg>
  );
  return (
    <svg aria-hidden="true" focusable="false" width="260" height="200" viewBox="0 0 260 200"
      className="overview-illustration overview-illustration-note" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path className="overview-brain" d="M39 65c-3-23 23-39 43-27 17-26 49-13 51 7 25-8 45 14 37 34 20 15 17 42-1 51 4 27-23 39-42 26-18 24-44 15-50 1-25 9-44-7-42-28-25-10-28-47 4-64Z" />
      <path d="M81 132c-17 13-34-5-24-20-16-15-1-40 17-31-4-23 25-30 33-14 12-25 39-8 32 10 23-1 29 25 12 36 11 20-11 37-25 27-12 19-36 11-39-6m-13-53c13 3 17 15 11 25m22-39c-6 13-2 22 4 27-14 8-15 18-7 27m35-44c-13 6-18 18-13 29m-69 6c13-6 26 4 25 16m43-7c0-11 7-17 17-17" />
      <path className="overview-illustration-paper" d="m147 57 91 15-14 109-91-15Z" />
      <path d="m169 95 39 6m-42 16 27 4" />
      <circle cx="169" cy="141" r="1.6" fill="currentColor" />
      <circle cx="200" cy="146" r="1.6" fill="currentColor" />
      <path d="M172 153c5 8 14 10 22 5" />
      <path className="overview-ink-accent" d="m216 42 2-13m8 24 10-10m4 20 14-2" />
    </svg>
  );
}
