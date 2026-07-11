import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import { authClient } from "@/lib/auth-client";
import { ApiError } from "@/lib/api";
import { signInWithDiscord } from "@/lib/auth";
import { useSetupStatus } from "@/features/onboarding/hooks/setup";

export function useAuthGate() {
  const session = authClient.useSession();
  const signInStarted = useRef(false);

  useEffect(() => {
    if (session.isPending || session.data) return;
    if (signInStarted.current) return;

    signInStarted.current = true;
    signInWithDiscord();
  }, [session.data, session.isPending]);

  return session;
}

export function useSetupRedirect() {
  const navigate = useNavigate();
  const location = useLocation();
  const session = authClient.useSession();
  const setupStatus = useSetupStatus(Boolean(session.data));

  useEffect(() => {
    if (!session.data || setupStatus.isPending) return;
    if (location.pathname === "/onboarding") return;
    if (setupStatus.data?.complete) return;

    navigate("/onboarding", { replace: true });
  }, [
    location.pathname,
    navigate,
    session.data,
    setupStatus.data?.complete,
    setupStatus.isPending,
  ]);
}

export function useProductAccessRedirect(error: unknown) {
  const navigate = useNavigate();
  const signInStarted = useRef(false);

  useEffect(() => {
    if (!(error instanceof ApiError)) return;

    if (error.status === 401) {
      if (signInStarted.current) return;
      signInStarted.current = true;
      signInWithDiscord();
      return;
    }

    if (error.code === "ONBOARDING_REQUIRED") {
      navigate("/onboarding", { replace: true });
    }
  }, [error, navigate]);
}
