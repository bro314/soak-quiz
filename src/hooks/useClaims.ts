import { useEffect, useState, useCallback } from "react";
import { onIdTokenChanged } from "firebase/auth";
import { auth } from "../firebase";

export interface UserClaims {
  role: "admin" | "team" | null;
  eventId: string | null;
  teamId?: string | null;
}

export function useClaims() {
  const [claims, setClaims] = useState<UserClaims>({ role: null, eventId: null });
  const [loading, setLoading] = useState(true);

  const fetchClaims = useCallback(async (user: any) => {
    if (!user) {
      setClaims({ role: null, eventId: null });
      setLoading(false);
      return;
    }
    try {
      const idTokenResult = await user.getIdTokenResult();
      const claimsData = idTokenResult.claims;
      setClaims({
        role: (claimsData.role as "admin" | "team") || null,
        eventId: (claimsData.eventId as string) || null,
        teamId: (claimsData.teamId as string) || null,
      });
    } catch (error) {
      console.error("Error fetching user claims:", error);
      setClaims({ role: null, eventId: null });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (user) => {
      setLoading(true);
      await fetchClaims(user);
    });
    return unsubscribe;
  }, [fetchClaims]);

  const refreshClaims = useCallback(async () => {
    const user = auth.currentUser;
    if (user) {
      setLoading(true);
      // Force token refresh to fetch the latest custom claims
      await user.getIdToken(true);
      await fetchClaims(user);
    }
  }, [fetchClaims]);

  return { claims, loading, refreshClaims };
}
