import { DEFAULT_FETCH_OPTIONS } from './constants.js';
import { isValidResponse } from './errors.js';
import { EncodedAttestationCredential } from './attestation.encoder.js';

/**
 * The `DEFAULT_ATTESTATION_OPTIONS` variable defines the default configuration
 * options for attestation during the authentication process.
 *
 * Properties:
 * - `attestationType`: Specifies the type of attestation. Defaults to 'none'.
 * - `authenticatorSelection`: Describes the settings for the authenticator to be used.
 *   - `authenticatorAttachment`: Defines whether the authenticator is platform-bound or not. Defaults to 'platform'.
 *   - `userVerification`: Indicates the requirement for user verification. Defaults to 'required'.
 *   - `requireResidentKey`: Determines whether the creation of a resident key is required. Defaults to false.
 * - `extensions`: Includes additional, optional WebAuthn extension settings.
 *   - `liquid`: A custom extension enabled by default with a value of true.
 *
 * @internal
 */
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

/**
 * Fetches an attestation request from the specified origin with the provided options.
 *
 * @param {string} origin - The URL of the origin from which the attestation request will be fetched.
 * @param {object} [options=DEFAULT_ATTESTATION_OPTIONS] - The options to include in the attestation request payload. Defaults to `DEFAULT_ATTESTATION_OPTIONS`.
 * @return {Promise<Response>} A promise that resolves to the response of the fetch request.
 * @todo: Generate Typed JSON-RPC clients from Swagger/OpenAPI
 */
export async function postOptions(
  origin: string,
  options = DEFAULT_ATTESTATION_OPTIONS,
) {
  return await fetch(`${origin}/attestation/request`, {
    ...DEFAULT_FETCH_OPTIONS,
    body: JSON.stringify(options),
  }).then((r) => {
    if (!isValidResponse(r)) throw new Error(r.statusText);
    return r.json();
  });
}

/**
 * Fetch interface for Attestation Response
 *
 * @param origin
 * @param credential
 * @todo: Generate Typed JSON-RPC clients from Swagger/OpenAPI
 */
export async function postResponse(
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
