import { authClient } from "@/lib/auth-client";

export function authCallbackUrl(path = `${window.location.pathname}${window.location.search}`) {
  return `${window.location.origin}${path}`;
}

export function signInWithDiscord(path?: string) {
  void authClient.signIn.social({
    provider: "discord",
    callbackURL: authCallbackUrl(path),
  });
}
