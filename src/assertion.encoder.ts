import { CREDENTIAL_ACTION_FAILURE, INVALID_INPUT_MESSAGE } from './errors.js';
import { fromBase64Url, toBase64URL } from './encoding.js';

/**
 * Represents an encoded authenticator assertion response typically used in WebAuthn authentication.
 * This type defines the structure of the response and ensures all required fields are provided in string format.
 *
 * EncodedAuthenticatorAssertionResponse includes:
 * - A map of additional string properties if needed.
 * - Fields such as `clientDataJSON`, `authenticatorData`, `signature`, and `userHandle`.
 *
 * The primary purpose of this type is to encapsulate the components originating from the authenticator
 * required to validate the authentication assertion.
 *
 * @protected
 */
export type EncodedAuthenticatorAssertionResponse = {
  [k: string]: string;
  clientDataJSON: string;
  authenticatorData: string;
  signature: string;
  userHandle: string;
};

/**
 *
 * @param response
 * @protected
 */
export function encodeResponse(
  response: AuthenticatorAssertionResponse & Record<string, ArrayBuffer>,
) {
  return Object.keys(
    AuthenticatorAssertionResponse.prototype,
  ).reduce<EncodedAuthenticatorAssertionResponse>(
    (prev, curr) => {
      prev[curr] = toBase64URL(response[curr]);
      return prev;
    },
    {
      clientDataJSON: toBase64URL(response.clientDataJSON),
    } as EncodedAuthenticatorAssertionResponse,
  );
}
/**
 * EncodedPublicKeyCredentialDescriptor represents a type that extends the PublicKeyCredentialDescriptor interface
 * with an additional requirement for the 'id' property to be of type string.
 *
 * This type is used to encapsulate the properties of a public key credential, including its unique identifier,
 * in a form where the 'id' is explicitly defined as a string rather than an ArrayBuffer.
 *
 * It is typically utilized in contexts where serialized or encoded values of public key credentials are required.
 *
 * Properties:
 * - id: A string representation of the unique identifier for the public key credential.
 *
 * This type is a combination of PublicKeyCredentialDescriptor properties and overrides for specific use cases
 * requiring encoded identifiers.
 * @protected
 */
export type EncodedPublicKeyCredentialDescriptor =
  PublicKeyCredentialDescriptor & {
    id: string;
  };
/**
 * EncodedPublicKeyCredentialRequestOptions is a composite type that extends
 * the PublicKeyCredentialRequestOptions interface. This type is designed
 * to represent request options for a WebAuthn authentication process,
 * with specific adjustments to handle encoded data formats.
 *
 * The primary purpose of this type is to ensure compatibility with encoded
 * challenges and allow credentials that are represented in an encoded format.
 *
 * Properties:
 * - Includes all properties from PublicKeyCredentialRequestOptions.
 * - `allowCredentials` (optional): An array of encoded credential descriptors
 *   that specify which credentials may be used for the assertion.
 * - `challenge`: A cryptographic random challenge provided in encoded format,
 *   used in the WebAuthn assertion process.
 *
 * This type is intended to support workflows where cryptographic data must
 * be encoded for transport or storage.
 *
 * @protected
 */
export type EncodedPublicKeyCredentialRequestOptions =
  PublicKeyCredentialRequestOptions & {
    allowCredentials?: EncodedPublicKeyCredentialDescriptor[];
    challenge: string;
  };
/**
 * Decodes the given assertion request options by converting base64URL-encoded fields
 * into their corresponding ArrayBuffer representations and returns the decoded options.
 *
 * @param {EncodedPublicKeyCredentialRequestOptions} options - The encoded credential options to decode, containing properties such as `challenge` and `allowCredentials`.
 * @return {PublicKeyCredentialRequestOptions} The decoded credential request options with binary data fields properly converted.
 */
export function decodeOptions(
  options: EncodedPublicKeyCredentialRequestOptions,
): PublicKeyCredentialRequestOptions {
  if (typeof options !== 'object' || typeof options.challenge !== 'string')
    throw new TypeError(INVALID_INPUT_MESSAGE);
  const decodedOptions: PublicKeyCredentialRequestOptions = { ...options };
  decodedOptions.challenge = fromBase64Url(options.challenge as string);
  decodedOptions.allowCredentials =
    options.allowCredentials?.map(
      (cred: EncodedPublicKeyCredentialDescriptor) => {
        return {
          ...cred,
          id: fromBase64Url(cred.id as string),
        } as PublicKeyCredentialDescriptor;
      },
    ) || [];
  return decodedOptions;
}

/**
 * @protected
 */
export type EncodedCredential = {
  [k: string]: string | EncodedAuthenticatorAssertionResponse;
  id: string;
  type: string;
  response: EncodedAuthenticatorAssertionResponse;
  rawId: string;
};

/**
 * Encodes the provided PublicKeyCredential into an EncodedCredential object.
 *
 * @param {PublicKeyCredential} credential - The PublicKeyCredential to be encoded.
 * @return {EncodedCredential} A new object containing the encoded properties of the credential.
 * @throws {Error} Throws an error if the input credential is invalid or cannot be processed.
 */
export function encodeCredential(
  credential: Credential | null,
): EncodedCredential {
  if (!credential) throw new Error(INVALID_INPUT_MESSAGE);
  const response = (credential as PublicKeyCredential)
    .response as AuthenticatorAssertionResponse & Record<string, ArrayBuffer>;
  if (!response) throw new Error(CREDENTIAL_ACTION_FAILURE);
  return {
    id: credential.id,
    type: credential.type,
    rawId: toBase64URL((credential as PublicKeyCredential).rawId),
    response: encodeResponse(response),
  };
}
