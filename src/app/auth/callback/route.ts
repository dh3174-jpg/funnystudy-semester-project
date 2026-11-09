import { getAuthOrigin } from "@/lib/auth-origin";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  buildDemographicsPath,
  hasPendingDemographicQuestions,
} from "@/lib/demographics";
import { createClient } from "@/lib/supabase/server";
import { DEMOGRAPHIC_SKIPS_COOKIE } from "@/lib/demographic-skips";
import { buildNotificationPreferencesPath, fetchNotificationPreferences, notificationNextPath, NOTIFICATION_SKIPS_COOKIE } from "@/lib/notification-preferences";

// Log structured identifiers only, never raw messages, codes, tokens, or cookies.
const diagnosticIdentifier = (value: unknown) =>
  typeof value === "string" && /^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(value)
    ? value : undefined;

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const redirectOrigin = getAuthOrigin(request);
  const code = requestUrl.searchParams.get("code");
  const cookieStore = await cookies();
  const next = notificationNextPath(
    cookieStore.get("login_next")?.value ?? requestUrl.searchParams.get("next")
  );

  if (code) {
    const supabase = await createClient({ allowCookieWrite: true });
    const hasCodeVerifier = cookieStore.getAll().some(({ name, value }) =>
      /^sb-.+-funnystudy-auth-token-code-verifier(?:\.\d+)?$/.test(name) && Boolean(value)
    );
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("[Auth callback] code exchange failed", {
        name: diagnosticIdentifier(error.name),
        code: diagnosticIdentifier(error.code),
        status: typeof error.status === "number" ? error.status : undefined,
        hasCodeVerifier,
      });
      const redirectUrl = new URL("/login", redirectOrigin);
      redirectUrl.searchParams.set(
        "message",
        "Unable to complete sign-in. Please try again."
      );
      return NextResponse.redirect(redirectUrl, 303);
    }

    cookieStore.delete(DEMOGRAPHIC_SKIPS_COOKIE);
    cookieStore.delete(NOTIFICATION_SKIPS_COOKIE);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user && (await fetchNotificationPreferences(supabase, user.id)).pending.length) {
      const response = NextResponse.redirect(new URL(buildNotificationPreferencesPath(next), redirectOrigin), 303);
      response.cookies.set({ name: "login_next", value: "", maxAge: 0, path: "/" });
      return response;
    }

    if (user && (await hasPendingDemographicQuestions(supabase, user.id))) {
      const demographicsUrl = new URL(
        buildDemographicsPath({ next }),
        redirectOrigin
      );
      const response = NextResponse.redirect(demographicsUrl, 303);
      response.cookies.set({
        name: "login_next",
        value: "",
        maxAge: 0,
        path: "/",
      });
      return response;
    }
  }

  const redirectUrl = new URL(next, redirectOrigin);
  const response = NextResponse.redirect(redirectUrl, 303);
  response.cookies.set({
    name: "login_next",
    value: "",
    maxAge: 0,
    path: "/",
  });

  return response;
}
