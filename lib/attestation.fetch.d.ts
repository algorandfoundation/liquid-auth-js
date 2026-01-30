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
export declare const DEFAULT_ATTESTATION_OPTIONS: {
    attestationType: string;
    authenticatorSelection: {
        authenticatorAttachment: string;
        userVerification: string;
        requireResidentKey: boolean;
    };
    extensions: {
        liquid: boolean;
    };
};
/**
 * Fetches an attestation request from the specified origin with the provided options.
 *
 * @param {string} origin - The URL of the origin from which the attestation request will be fetched.
 * @param {object} [options=DEFAULT_ATTESTATION_OPTIONS] - The options to include in the attestation request payload. Defaults to `DEFAULT_ATTESTATION_OPTIONS`.
 * @return {Promise<Response>} A promise that resolves to the response of the fetch request.
 * @todo: Generate Typed JSON-RPC clients from Swagger/OpenAPI
 */
export declare function postOptions(origin: string, options?: {
    attestationType: string;
    authenticatorSelection: {
        authenticatorAttachment: string;
        userVerification: string;
        requireResidentKey: boolean;
    };
    extensions: {
        liquid: boolean;
    };
}): Promise<any>;
/**
 * Fetch interface for Attestation Response
 *
 * @param origin
 * @param credential
 * @todo: Generate Typed JSON-RPC clients from Swagger/OpenAPI
 */
export declare function postResponse(origin: string, credential: EncodedAttestationCredential): Promise<any>;
