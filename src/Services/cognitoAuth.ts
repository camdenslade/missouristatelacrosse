import {
  AuthenticationDetails,
  CognitoUser,
  CognitoUserPool,
} from "amazon-cognito-identity-js";
import type { CognitoUserSession } from "amazon-cognito-identity-js";

// Both ids are public (they ship in every browser bundle); the env vars only exist so a
// staging pool can be pointed at without a code change.
const USER_POOL_ID = import.meta.env.VITE_COGNITO_USER_POOL_ID || "us-east-1_HqmiTqIrF";
const CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID || "30vmrujtptv5n4iqosjaclmvla";

const pool = new CognitoUserPool({ UserPoolId: USER_POOL_ID, ClientId: CLIENT_ID });

/** The signed-in person as the rest of the app sees them. uid is our account id, not Cognito's. */
export type AuthUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
};

// The account uid comes from the backend after sign-in (Cognito only knows its own id) and is
// sent as X-User-Id on every request.
let currentUid: string | null = null;
export const setCurrentUid = (uid: string | null) => {
  currentUid = uid;
};
export const getCurrentUid = () => currentUid;

const normalize = (email: string) => email.trim().toLowerCase();

/** The stored session, refreshed automatically if the id token expired. Null if signed out. */
export function getSession(): Promise<CognitoUserSession | null> {
  const user = pool.getCurrentUser();
  if (!user) return Promise.resolve(null);
  return new Promise((resolve) => {
    user.getSession((err: Error | null, session: CognitoUserSession | null) => {
      resolve(err || !session || !session.isValid() ? null : session);
    });
  });
}

export async function getIdToken(): Promise<string | null> {
  const session = await getSession();
  return session ? session.getIdToken().getJwtToken() : null;
}

/**
 * Signs in with email and password. Uses the plain password flow, not SRP, because Cognito's
 * user-migration trigger (which lets people who only had a Firebase password sign in) only
 * runs for it. The password travels over TLS to Cognito, same as before with Firebase.
 */
export function signIn(email: string, password: string): Promise<CognitoUserSession> {
  const username = normalize(email);
  const user = new CognitoUser({ Username: username, Pool: pool });
  user.setAuthenticationFlowType("USER_PASSWORD_AUTH");
  const details = new AuthenticationDetails({ Username: username, Password: password });
  return new Promise((resolve, reject) => {
    user.authenticateUser(details, {
      onSuccess: resolve,
      onFailure: reject,
      newPasswordRequired: () => {
        reject(Object.assign(new Error("A password reset is required."), { code: "PasswordResetRequiredException" }));
      },
    });
  });
}

export function signOut(): void {
  pool.getCurrentUser()?.signOut();
  currentUid = null;
}

/** Emails a reset code. Resolves whether or not the address has an account (no probing). */
export function requestPasswordReset(email: string): Promise<void> {
  const user = new CognitoUser({ Username: normalize(email), Pool: pool });
  return new Promise((resolve, reject) => {
    user.forgotPassword({
      onSuccess: () => resolve(),
      inputVerificationCode: () => resolve(),
      onFailure: reject,
    });
  });
}

export function confirmPasswordReset(email: string, code: string, newPassword: string): Promise<void> {
  const user = new CognitoUser({ Username: normalize(email), Pool: pool });
  return new Promise((resolve, reject) => {
    user.confirmPassword(code.trim(), newPassword, {
      onSuccess: () => resolve(),
      onFailure: reject,
    });
  });
}

/** Turns a Cognito error into something a person can act on. */
export function describeAuthError(err: unknown): string {
  const code = (err as { code?: string; name?: string })?.code || (err as { name?: string })?.name;
  switch (code) {
    case "NotAuthorizedException":
    case "UserNotFoundException":
      return "Incorrect email or password.";
    case "PasswordResetRequiredException":
      return "Your password needs to be reset. Use \"Forgot password?\" below.";
    case "TooManyRequestsException":
    case "LimitExceededException":
      return "Too many attempts. Please wait a moment and try again.";
    case "InvalidPasswordException":
      return "That password is not allowed. Use at least 8 characters.";
    case "CodeMismatchException":
      return "That code is not right. Check the email and try again.";
    case "ExpiredCodeException":
      return "That code has expired. Request a new one.";
    case "UserNotConfirmedException":
      return "This account is not active yet.";
    default:
      return err instanceof Error && err.message ? err.message : "Something went wrong. Please try again.";
  }
}
