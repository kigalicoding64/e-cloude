/** OAuth / OpenID Connect scope catalogue for EGREED Connect sign-in. */
export const API_SCOPES = ["read", "download", "upload", "manage"] as const;

export const OAUTH_SCOPES = [
  "openid",
  "profile",
  "email",
  "phone",
  "offline_access",
  "organizations:read",
] as const;

export type OAuthScope = (typeof OAUTH_SCOPES)[number];

export const OAUTH_SCOPE_DESCRIPTIONS: Record<OAuthScope, string> = {
  openid: "Issue an ID token proving who signed in",
  profile: "Name and picture",
  email: "Email address and verification status",
  phone: "Phone number and verification status",
  offline_access: "Refresh tokens so the app stays signed in",
  "organizations:read": "Organization memberships and roles",
};

export function isOAuthScope(value: string): value is OAuthScope {
  return (OAUTH_SCOPES as readonly string[]).includes(value);
}
