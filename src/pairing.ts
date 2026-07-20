import { ServiceError, isValidResponse } from "./errors.ts";
import type { PairingCredential, PairingInvitation, PairingStatus } from "./types.ts";

export type PairingFetch = (input: string | URL, init?: RequestInit) => Promise<Response>;

const PAIRING_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
const BEARER_CREDENTIAL_PATTERN = /^[A-Za-z0-9._~+/-]+={0,}$/;

function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

function isPairingId(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 256 ||
    value.trim() !== value ||
    value === "." ||
    value === ".." ||
    hasControlCharacter(value)
  ) {
    return false;
  }
  try {
    encodeURIComponent(value);
    return true;
  } catch {
    return false;
  }
}

function isCredential(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 4096 &&
    BEARER_CREDENTIAL_PATTERN.test(value)
  );
}

function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

export function isPairingCredential(value: unknown): value is PairingCredential {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const pairing = value as Partial<PairingCredential>;
  return (
    pairing.version === 2 &&
    isPairingId(pairing.pairingId) &&
    (pairing.role === "provider" || pairing.role === "controller") &&
    isCredential(pairing.credential)
  );
}

export function isPairingInvitation(value: unknown): value is PairingInvitation {
  return (
    isPairingCredential(value) &&
    value.role === "provider" &&
    isIsoTimestamp((value as Partial<PairingInvitation>).expiresAt)
  );
}

export function isPairingStatus(value: unknown): value is PairingStatus {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const status = value as Partial<PairingStatus>;
  if (
    status.version !== 2 ||
    !isPairingId(status.pairingId) ||
    (status.role !== "provider" && status.role !== "controller")
  ) {
    return false;
  }
  if (status.status === "pending") {
    return status.role === "provider" && status.wallet === undefined;
  }
  return (
    (status.status === "active" || status.status === "revoked") &&
    typeof status.wallet === "string" &&
    status.wallet.length > 0
  );
}

function pairingUrl(origin: string, path: string): string {
  if (typeof origin !== "string" || origin.length === 0 || origin.trim() !== origin) {
    throw new TypeError("Pairing origin must be an absolute HTTP(S) URL");
  }
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    throw new TypeError("Pairing origin must be an absolute HTTP(S) URL");
  }
  if (
    (parsed.protocol !== "https:" && parsed.protocol !== "http:") ||
    parsed.username.length > 0 ||
    parsed.password.length > 0 ||
    parsed.search.length > 0 ||
    parsed.hash.length > 0
  ) {
    throw new TypeError(
      "Pairing origin must be an absolute HTTP(S) URL without credentials, query, or fragment",
    );
  }
  return `${parsed.toString().replace(/\/+$/, "")}${path}`;
}

function validatePairingCredential(pairing: PairingCredential): void {
  if (!isPairingCredential(pairing)) throw new TypeError("Invalid pairing credential");
}

async function responseJson(response: Response, invalidMessage: string): Promise<unknown> {
  try {
    return await response.json();
  } catch (error) {
    if (error && typeof error === "object" && "name" in error && error.name === "AbortError") {
      throw error;
    }
    throw new ServiceError(invalidMessage);
  }
}

function authorizationHeaders(pairing: PairingCredential): Record<string, string> {
  return {
    Authorization: `Bearer ${pairing.credential}`,
    "X-Pairing-Role": pairing.role,
  };
}

/** Create a provider-side invitation. The returned credential is secret. */
export async function createPairingInvitation(
  origin: string,
  options: { requestId?: string; fetch?: PairingFetch; signal?: AbortSignal } = {},
): Promise<PairingInvitation> {
  if (
    options.requestId !== undefined &&
    (typeof options.requestId !== "string" ||
      options.requestId.length < 16 ||
      options.requestId.length > 256 ||
      !PAIRING_ID_PATTERN.test(options.requestId))
  ) {
    throw new TypeError("Pairing requestId must be 16-256 URL-safe characters");
  }
  const fetchImpl = options.fetch ?? globalThis.fetch;
  const response = await fetchImpl(pairingUrl(origin, "/pairings/invitations"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options.requestId === undefined ? {} : { requestId: options.requestId }),
    ...(options.signal ? { signal: options.signal } : {}),
  });
  if (!isValidResponse(response)) {
    throw new ServiceError(
      `Failed to create pairing invitation: ${response.status} ${response.statusText}`,
    );
  }
  const invitation = await responseJson(response, "Pairing invitation response was invalid");
  if (
    !isPairingInvitation(invitation) ||
    (options.requestId !== undefined && invitation.pairingId !== options.requestId)
  ) {
    throw new ServiceError("Pairing invitation response was invalid");
  }
  return invitation;
}

/** Read the durable pairing state using the caller's role-bound credential. */
export async function getPairingStatus(
  origin: string,
  pairing: PairingCredential,
  options: { fetch?: PairingFetch; signal?: AbortSignal } = {},
): Promise<PairingStatus> {
  validatePairingCredential(pairing);
  const fetchImpl = options.fetch ?? globalThis.fetch;
  const response = await fetchImpl(
    pairingUrl(origin, `/pairings/${encodeURIComponent(pairing.pairingId)}/status`),
    {
      method: "GET",
      credentials: "include",
      headers: authorizationHeaders(pairing),
      ...(options.signal ? { signal: options.signal } : {}),
    },
  );
  if (!response.ok) {
    throw new ServiceError(
      `Failed to read pairing status: ${response.status} ${response.statusText}`,
    );
  }
  const status = await responseJson(response, "Pairing status response was invalid");
  if (
    !isPairingStatus(status) ||
    status.pairingId !== pairing.pairingId ||
    status.role !== pairing.role
  ) {
    throw new ServiceError("Pairing status response was invalid");
  }
  return status;
}

/** Revoke a durable pairing using the caller's role-bound credential. */
export async function revokePairing(
  origin: string,
  pairing: PairingCredential,
  options: { fetch?: PairingFetch; signal?: AbortSignal } = {},
): Promise<void> {
  validatePairingCredential(pairing);
  const fetchImpl = options.fetch ?? globalThis.fetch;
  const response = await fetchImpl(
    pairingUrl(origin, `/pairings/${encodeURIComponent(pairing.pairingId)}`),
    {
      method: "DELETE",
      credentials: "include",
      headers: authorizationHeaders(pairing),
      ...(options.signal ? { signal: options.signal } : {}),
    },
  );
  if (!response.ok && response.status !== 404 && response.status !== 410) {
    throw new ServiceError(`Failed to revoke pairing: ${response.status} ${response.statusText}`);
  }
}
