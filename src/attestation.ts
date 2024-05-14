/**
 * This module is only for browser and currently not used in the project.
 * However, it could be useful for extension wallets or other browser-based wallets.
 */
import { decodeAddress, fromBase64Url, toBase64URL } from './encoding.js';
import { DEFAULT_FETCH_OPTIONS } from './constants.js';
import { isValidResponse } from './errors.js';

export const DEFAULT_ATTESTATION_OPTIONS = {
  attestationType: 'none',
  authenticatorSelection: {
    authenticatorAttachment: 'platform',
    userVerification: 'required',
    requireResidentKey: false,
  },
  extensions: {
    liquid: true,
  },
};
export interface EncodedAuthenticatorAttestationResponse {
  [k: string]: string | undefined;
  clientDataJSON: string;
  attestationObject: string;
  signature?: string;
  userHandle?: string;
}
export interface EncodedAttestationCredential {
  [k: string]: string | EncodedAuthenticatorAttestationResponse;
  id: string;
  type: string;
  response: EncodedAuthenticatorAttestationResponse;
  rawId: string;
}

/**
 * Encode a PublicKeyCredential
 *
 * @param credential - PublicKeyCredential from navigator.credentials.create
 */
function encodeAttestationCredential(
  credential: PublicKeyCredential,
): EncodedAttestationCredential {
  const response = credential.response as AuthenticatorAttestationResponse;
  return {
    id: credential.id,
    rawId: toBase64URL(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: toBase64URL(response.clientDataJSON),
      attestationObject: toBase64URL(response.attestationObject),
    },
  };
}

function decodeAttestationOptions(options, liquidOptions) {
  const attestationOptions = { ...options };
  attestationOptions.user.id = decodeAddress(liquidOptions.address);
  attestationOptions.user.name = liquidOptions.address;
  attestationOptions.user.displayName = liquidOptions.address;
  attestationOptions.challenge = fromBase64Url(options.challenge);

  if (attestationOptions.excludeCredentials) {
    for (const cred of attestationOptions.excludeCredentials) {
      cred.id = fromBase64Url(cred.id);
    }
  }

  return attestationOptions;
}

/**
 * Fetch interface for Attestation Options
 *
 * @param origin
 * @param options
 * @todo: Generate Typed JSON-RPC clients from Swagger/OpenAPI
 */
export async function fetchAttestationRequest(
  origin: string,
  options = DEFAULT_ATTESTATION_OPTIONS,
) {
  return await fetch(`${origin}/attestation/request`, {
    ...DEFAULT_FETCH_OPTIONS,
    body: JSON.stringify(options),
  });
}

/**
 * Fetch interface for Attestation Response
 *
 * @param origin
 * @param credential
 * @todo: Generate Typed JSON-RPC clients from Swagger/OpenAPI
 */
export async function fetchAttestationResponse(
  origin: string,
  credential: EncodedAttestationCredential,
) {
  return await fetch(`${origin}/attestation/response`, {
    ...DEFAULT_FETCH_OPTIONS,
    body: JSON.stringify(credential),
  }).then((r) => {
    if (!isValidResponse(r)) throw new Error(r.statusText);
    return r.json();
  });
}

/**
 * Attestation
 *
 * The process of creating a new credential. It has two parts:
 *
 * - The server creates a challenge and sends it to the client
 * - The client creates a credential and sends it to the server
 *
 */
export async function attestation(
  origin: string,
  onChallenge: (options: any) => any,
  options = DEFAULT_ATTESTATION_OPTIONS,
) {
  const encodedAttestationOptions = await fetchAttestationRequest(
    origin,
    options,
  ).then((r) => {
    if (!isValidResponse(r)) throw new Error(r.statusText);
    return r.json();
  });
  if (typeof encodedAttestationOptions.error !== 'undefined') {
    throw new Error(encodedAttestationOptions.error);
  }

  const liquidOptions = await onChallenge(
    fromBase64Url(encodedAttestationOptions.challenge),
  );
  const decodedPublicKey = decodeAttestationOptions(
    encodedAttestationOptions,
    liquidOptions,
  );
  const credential = encodeAttestationCredential(
    (await navigator.credentials.create({
      publicKey: decodedPublicKey,
    })) as PublicKeyCredential,
  );
  credential.clientExtensionResults = { liquid: liquidOptions } as any;
  return await fetchAttestationResponse(origin, credential);
}
