import { INVALID_INPUT_MESSAGE } from "./errors.ts";
import { decodeAddress, fromBase64Url, toBase64URL } from "./encoding.ts";
import type {
  AuthenticatorAttestationResponseJSON,
  PublicKeyCredentialCreationOptions,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialDescriptor,
  PublicKeyCredentialDescriptorJSON,
  PublicKeyCredentialType,
  RegistrationResponseJSON,
} from "@simplewebauthn/browser";
import type { LiquidExtensionOptions } from "./types.ts";

/**
 * Encodes the AuthenticatorAttestationResponse into a JSON-compatible format.
 *
 * @param {AuthenticatorAttestationResponse} response - The response to encode.
 * @return {AuthenticatorAttestationResponseJSON} The encoded response.
 * @protected
 */
export function encodeResponse(
  response: AuthenticatorAttestationResponse,
): AuthenticatorAttestationResponseJSON {
  return {
    clientDataJSON: toBase64URL(response.clientDataJSON),
    attestationObject: toBase64URL(response.attestationObject),
  };
}

/**
 * Encodes the given attestation credential into a structured format.
 *
 * @param {PublicKeyCredential} credential - The credential object to be encoded,
 * typically obtained during the registration phase of WebAuthn.
 * @return {RegistrationResponseJSON} An object containing the encoded credential information,
 * including its ID, type, and response fields in base64 URL format.
 */
export function encodeCredential(credential: Credential | null): RegistrationResponseJSON {
  if (!credential) throw new Error(INVALID_INPUT_MESSAGE);
  const response = (credential as PublicKeyCredential).response as AuthenticatorAttestationResponse;
  return {
    id: credential.id,
    rawId: toBase64URL((credential as PublicKeyCredential).rawId),
    type: (credential as PublicKeyCredential).type as PublicKeyCredentialType,
    response: encodeResponse(response),
    clientExtensionResults: (credential as PublicKeyCredential).getClientExtensionResults(),
  };
}

/**
 * Decodes and processes the attestation options with additional address and challenge decoding.
 *
 * @param {PublicKeyCredentialCreationOptionsJSON} options - The original attestation options, including user and credentials information.
 * @param {LiquidExtensionOptions} liquidOptions - Contains additional data such as the address used for decoding.
 * @return {PublicKeyCredentialCreationOptions} Returns the updated attestation options with decoded user address, display name, and challenge.
 */
export function decodeOptions(
  options: PublicKeyCredentialCreationOptionsJSON,
  liquidOptions: LiquidExtensionOptions,
): PublicKeyCredentialCreationOptions {
  return {
    ...options,
    user: {
      ...options.user,
      id: decodeAddress(liquidOptions.address).publicKey,
      name: liquidOptions.address,
      displayName: liquidOptions.address,
    },
    challenge: fromBase64Url(options.challenge),
    excludeCredentials: options.excludeCredentials?.map(
      (cred: PublicKeyCredentialDescriptorJSON) => {
        return {
          ...cred,
          id: fromBase64Url(cred.id),
        } as PublicKeyCredentialDescriptor;
      },
    ),
  };
}
