export const HOME_ROUTE = "/";
export const CLASSES_ROUTE = "/classes";
export const AUTH_SIGNIN_ROUTE = "/auth/signin";
export const AUTH_SIGNUP_ROUTE = "/auth/signup";
export const MANAGER_ROUTE = "/manager";
export const MANAGER_CLASSES_ROUTE = "/manager/classes";

function isSafeInternalPath(value: string): boolean {
  if (!value.startsWith("/")) {
    return false;
  }

  // Reject protocol-relative redirects like //example.com.
  if (value.startsWith("//")) {
    return false;
  }

  return true;
}

export function getSafeReturnTo(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const normalizedValue = value.trim();
  if (!normalizedValue) {
    return null;
  }

  if (!isSafeInternalPath(normalizedValue)) {
    return null;
  }

  return normalizedValue;
}

export function getPostLoginDestination(returnTo: string | null): string {
  return getSafeReturnTo(returnTo) ?? CLASSES_ROUTE;
}
