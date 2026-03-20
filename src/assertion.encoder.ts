import { CREDENTIAL_ACTION_FAILURE, INVALID_INPUT_MESSAGE } from "./errors.js";
import { fromBase64Url, toBase64URL } from "./encoding.js";
import type {
  AuthenticationResponseJSON,
  AuthenticatorAssertionResponseJSON,
  PublicKeyCredentialDescriptor,
  PublicKeyCredentialDescriptorJSON,
  PublicKeyCredentialRequestOptions,
  PublicKeyCredentialRequestOptionsJSON,
  PublicKeyCredentialType,
} from "@simplewebauthn/browser";

/**
 * Encodes the AuthenticatorAssertionResponse into a JSON-compatible format.
 *
 * @param {AuthenticatorAssertionResponse} response - The response to encode.
 * @return {AuthenticatorAssertionResponseJSON} The encoded response.
 * @protected
 */
export function encodeResponse(
  response: AuthenticatorAssertionResponse,
): AuthenticatorAssertionResponseJSON {
  return {
    clientDataJSON: toBase64URL(response.clientDataJSON),
    authenticatorData: toBase64URL(response.authenticatorData),
    signature: response.signature ? toBase64URL(response.signature) : "",
    userHandle: response.userHandle ? toBase64URL(response.userHandle) : undefined,
  };
}

/**
 * Decodes the given assertion request options by converting base64URL-encoded fields
 * into their corresponding ArrayBuffer representations and returns the decoded options.
 *
 * @param {PublicKeyCredentialRequestOptionsJSON} options - The encoded credential options to decode, containing properties such as `challenge` and `allowCredentials`.
 * @return {PublicKeyCredentialRequestOptions} The decoded credential request options with binary data fields properly converted.
 */
export function decodeOptions(
  options: PublicKeyCredentialRequestOptionsJSON,
): PublicKeyCredentialRequestOptions {
  if (typeof options !== "object" || typeof options.challenge !== "string")
    throw new TypeError(INVALID_INPUT_MESSAGE);
  return {
    ...options,
    challenge: fromBase64Url(options.challenge),
    allowCredentials:
      options.allowCredentials?.map((cred: PublicKeyCredentialDescriptorJSON) => {
        return {
          ...cred,
          id: fromBase64Url(cred.id),
        } as PublicKeyCredentialDescriptor;
      }) || [],
  };
}

/**
 * Encodes the provided PublicKeyCredential into an EncodedCredential object.
 *
 * @param {Credential | null} credential - The PublicKeyCredential to be encoded.
 * @return {AuthenticationResponseJSON} A new object containing the encoded properties of the credential.
 * @throws {Error} Throws an error if the input credential is invalid or cannot be processed.
 */
export function encodeCredential(credential: Credential | null): AuthenticationResponseJSON {
  if (!credential) throw new Error(INVALID_INPUT_MESSAGE);
  const response = (credential as PublicKeyCredential).response as AuthenticatorAssertionResponse;
  if (!response) throw new Error(CREDENTIAL_ACTION_FAILURE);
  return {
    id: credential.id,
    type: credential.type as PublicKeyCredentialType,
    rawId: toBase64URL((credential as PublicKeyCredential).rawId),
    response: encodeResponse(response),
    clientExtensionResults: (credential as PublicKeyCredential).getClientExtensionResults(),
  };
}
