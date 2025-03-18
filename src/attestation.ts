/**
 * This module is only for the browser and currently not used in the project.
 * However, it could be useful for extension wallets or other browser-based wallets.
 *
 * @packageDocumentation
 * @document ./attestation.guide.md
 */
import { fromBase64Url } from './encoding.js';
import {
  AUTHENTICATOR_NOT_SUPPORTED_MESSAGE,
  INVALID_INPUT_MESSAGE,
} from './errors.js';
import {
  DEFAULT_ATTESTATION_OPTIONS,
  postOptions,
  postResponse,
} from './attestation.fetch.js';
import { decodeOptions, encodeCredential } from './attestation.encoder.js';

export * as fetch from './attestation.fetch.js';
export * as encoder from './attestation.encoder.js';

type AttestationOptions = {
  origin: string;
  onChallenge: (options: any) => any;
  options?: any;
  debug?: boolean;
};

/**
 * Performs an attestation process that involves fetching options,
 * handling a challenge, and creating a credential using the Web Authentication API.
 *
 * @param {Object} params - The configuration options for the attestation process.
 * @param {string} params.origin - The origin URL to which requests are made.
 * @param {Function} params.onChallenge - A function to handle the challenge returned by the service.
 * @param {Object} [params.options=DEFAULT_ATTESTATION_OPTIONS] - Options to customize the attestation process.
 * @param {boolean} [params.debug=false] - Flag to enable or disable debug logging.
 * @return {Promise<any>} The response from the server after completing the attestation process.
 */
export async function attestation(params: AttestationOptions) {
  if (typeof navigator === 'undefined')
    throw new Error(AUTHENTICATOR_NOT_SUPPORTED_MESSAGE);
  if (typeof params === 'undefined') throw new Error(INVALID_INPUT_MESSAGE);
  const {
    origin,
    onChallenge,
    options = DEFAULT_ATTESTATION_OPTIONS,
    debug,
  } = params;
  if (typeof origin !== 'string') {
    throw new TypeError(INVALID_INPUT_MESSAGE);
  }
  debug &&
    console.log(
      `%cFETCHING: %c/attestation/request/`,
      'color: yellow',
      'color: cyan',
    );

  // Fetch the options from the service
  const credentialOptions = await postOptions(origin, options);

  debug &&
    console.log(
      '%cHANDLE_SIGNATURE:%c onChallenge',
      'color: yellow',
      'color: cyan',
      '*'.repeat(credentialOptions.challenge.length),
    );

  // Handle the additional signature challenge
  const liquidOptions = await onChallenge(
    fromBase64Url(credentialOptions.challenge),
  );

  debug &&
    console.log(
      '%cDECODE:%c assertion.encoder.decodeOptions',
      'color: yellow',
      'color: cyan',
      '*'.repeat(liquidOptions.signature.length),
    );

  // Decode the options and merge the extension
  const mergedOptions = decodeOptions(credentialOptions, liquidOptions);

  // Create the credential using the Credential API
  const credential = await navigator.credentials
    .create({
      publicKey: mergedOptions,
    })
    // Encode the credential for submitting to the service
    .then(encodeCredential);

  // Attach the extension results
  // TODO: this should be provided by the CredentialProvider Service
  credential.clientExtensionResults = { liquid: liquidOptions } as any;

  debug &&
    console.log(
      '%cPOSTING: %c/attestation/response',
      'color: yellow',
      'color: cyan',
      credential,
    );

  // Send the credential to the service
  return await postResponse(origin, credential);
}
