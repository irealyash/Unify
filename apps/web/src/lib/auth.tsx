import { Auth0Provider, useAuth0 } from "@auth0/auth0-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  type ReactNode,
} from "react";
import { setSocketAuthToken } from "@/lib/socket";
import { isTestMode, setTestMode } from "@/lib/testMode";

const domain = import.meta.env.VITE_AUTH0_DOMAIN as string | undefined;
const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID as string | undefined;

export function isAuthConfigured() {
  return Boolean(domain && clientId);
}

type GoogleAuthApi = {
  ready: boolean;
  configured: boolean;
  isAuthenticated: boolean;
  user: { name?: string; email?: string; picture?: string } | undefined;
  signIn: () => void;
  signOut: () => void;
  ensureSocketAuth: () => Promise<void>;
};

const missingAuth: GoogleAuthApi = {
  ready: true,
  configured: false,
  isAuthenticated: false,
  user: undefined,
  signIn: () => {
    console.warn("Auth0 is not configured");
  },
  signOut: () => {},
  ensureSocketAuth: async () => {
    throw new Error("Auth0 is not configured");
  },
};

/** Stands in for a signed-in user while test mode is on. */
const testModeAuth: GoogleAuthApi = {
  ready: true,
  configured: true,
  isAuthenticated: true,
  user: undefined,
  signIn: () => {},
  signOut: () => setTestMode(false),
  ensureSocketAuth: async () => {},
};

const AuthApiContext = createContext<GoogleAuthApi | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  if (!domain || !clientId) {
    console.warn("VITE_AUTH0_DOMAIN / VITE_AUTH0_CLIENT_ID missing — Google sign-in disabled");
    return <AuthApiContext.Provider value={missingAuth}>{children}</AuthApiContext.Provider>;
  }

  return (
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      authorizationParams={{
        redirect_uri: window.location.origin,
        connection: "google-oauth2",
      }}
      cacheLocation="localstorage"
      onRedirectCallback={(appState) => {
        // Drop Auth0's ?code=&state= so they aren't mistaken for a room code.
        const returnTo =
          typeof appState?.returnTo === "string" && appState.returnTo.startsWith("/")
            ? appState.returnTo
            : window.location.pathname;
        window.history.replaceState({}, document.title, returnTo);
      }}
    >
      <Auth0ApiProvider>{children}</Auth0ApiProvider>
    </Auth0Provider>
  );
}

async function syncAuthSession(getIdTokenClaims: ReturnType<typeof useAuth0>["getIdTokenClaims"]) {
  const claims = await getIdTokenClaims();
  const token = claims?.__raw;
  if (!token) throw new Error("Missing Auth0 ID token");
  await setSocketAuthToken(token);
  await fetch("/api/auth/sync", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  return token;
}

function Auth0ApiProvider({ children }: { children: ReactNode }) {
  const auth = useAuth0();

  useEffect(() => {
    if (auth.isLoading) return;
    let cancelled = false;

    async function sync() {
      if (!auth.isAuthenticated) {
        void setSocketAuthToken(null);
        return;
      }
      try {
        await syncAuthSession(auth.getIdTokenClaims);
      } catch (err) {
        if (!cancelled) console.warn("[auth] sync failed:", err);
      }
    }

    void sync();
    return () => {
      cancelled = true;
    };
  }, [auth.isAuthenticated, auth.isLoading, auth.getIdTokenClaims]);

  const signIn = useCallback(() => {
    void auth.loginWithRedirect({
      authorizationParams: {
        connection: "google-oauth2",
        redirect_uri: window.location.origin,
      },
      appState: { returnTo: window.location.pathname + window.location.search },
    });
  }, [auth]);

  const signOut = useCallback(() => {
    void setSocketAuthToken(null);
    void auth.logout({
      logoutParams: { returnTo: window.location.origin },
    });
  }, [auth]);

  const ensureSocketAuth = useCallback(async () => {
    if (!auth.isAuthenticated) throw new Error("Sign in with Google to continue");
    await syncAuthSession(auth.getIdTokenClaims);
  }, [auth]);

  const value: GoogleAuthApi = {
    ready: !auth.isLoading,
    configured: true,
    isAuthenticated: auth.isAuthenticated,
    user: auth.user,
    signIn,
    signOut,
    ensureSocketAuth,
  };

  return <AuthApiContext.Provider value={value}>{children}</AuthApiContext.Provider>;
}

export function useGoogleAuth(): GoogleAuthApi {
  const auth = useContext(AuthApiContext) ?? missingAuth;
  return isTestMode() ? testModeAuth : auth;
}
