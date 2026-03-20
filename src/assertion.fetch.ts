import { INVALID_INPUT_MESSAGE, INVALID_RESPONSE_MESSAGE, isValidResponse } from "./errors.js";
import { DEFAULT_FETCH_OPTIONS } from "./constants.js";
import type { User } from "./types.ts";
import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/browser";

/**
 * Fetch Assertion Options
 *
 * POST Authenticator Selector to the REST API
 * to receive the PublicKeyCredentialRequestOptions
 *
 * @param origin
 * @param credId
 * @todo: Generate Typed JSON-RPC clients from Swagger/OpenAPI
 * @module fetch
 */
export async function postOptions(
  origin: string,
  credId: string,
): Promise<PublicKeyCredentialRequestOptionsJSON> {
  if (typeof origin !== "string" || typeof credId !== "string") {
    throw new TypeError(INVALID_INPUT_MESSAGE);
  }
  return await fetch(`${origin}/assertion/request/${credId}`, {
    ...DEFAULT_FETCH_OPTIONS,
  }).then((r) => {
    if (!isValidResponse(r)) {
      throw new Error(INVALID_RESPONSE_MESSAGE);
    }
    return r.json() as Promise<PublicKeyCredentialRequestOptionsJSON>;
  });
}

/**
 * Fetch Assertion Response
 *
 * POST an Authenticator Assertion Response to the REST API
 *
 * @param origin
 * @param credential
 * @todo: Generate Typed JSON-RPC clients from Swagger/OpenAPI
 */
export async function postResponse(
  origin: string,
  credential: AuthenticationResponseJSON,
): Promise<User> {
  if (typeof origin !== "string" || typeof credential !== "object") {
    // TODO: instance check for SerializedCredential
    throw new TypeError(INVALID_INPUT_MESSAGE);
  }
  return await fetch(`${origin}/assertion/response`, {
    ...DEFAULT_FETCH_OPTIONS,
    body: JSON.stringify(credential),
  }).then((r) => {
    if (!isValidResponse(r)) {
      throw new Error(INVALID_RESPONSE_MESSAGE);
    }
    return r.json();
  });
}
