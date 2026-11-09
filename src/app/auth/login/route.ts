import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { getAuthOrigin, getAuthRequestOrigin } from "@/lib/auth-origin";
import { normalizeRelativePath } from "@/lib/url";

export async function POST(request: Request) {
  const formData = await request.formData();

  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const origin = getAuthOrigin(request);
  const next = normalizeRelativePath(formData.get("next")?.toString());
  const redirectTo = new URL("/auth/callback", origin);

  if (formData.getAll("site_terms").length !== 1 || formData.get("site_terms") !== "on") {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("message", "Please confirm that you are 18 or older, are in the United States, and agree to the Terms of Use.");
    loginUrl.searchParams.set("redirectedFrom", next);
    return NextResponse.redirect(loginUrl, 303);
  }

  // Set the PKCE verifier on the host that will receive the callback.
  // 307 preserves the native POST, consent, and destination; no Auth call or
  // verifier cookie is created on a preview/deployment hostname.
  if (getAuthRequestOrigin(request) !== origin) {
    return NextResponse.redirect(new URL("/auth/login", origin), 307);
  }

  if (!googleClientId) {
    return NextResponse.redirect(
      `${origin}/login?message=` +
        encodeURIComponent(
          "Google login is not configured. Please try again later."
        ),
      303
    );
  }

  const supabase = await createClient({
    allowCookieWrite: true,
    autoRefreshToken: false,
  });
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: redirectTo.toString(),
      queryParams: { client_id: googleClientId },
    },
  });

  if (error || !data?.url) {
    return NextResponse.redirect(
      `${origin}/login?message=` +
        encodeURIComponent("Unable to sign in right now. Please try again."),
      303
    );
  }

  const response = NextResponse.redirect(data.url, 303);
  response.cookies.set({
    name: "login_next",
    value: next,
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 10,
  });

  return response;
}
