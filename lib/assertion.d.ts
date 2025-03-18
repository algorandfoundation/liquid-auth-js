export * as fetch from './assertion.fetch.js';
export * as encoder from './assertion.encoder.js';
/**
 * Represents the options for an assertion used during authentication.
 */
export type AssertionOptions = {
    /**
     * Represents the origin service to which a request should be sent.
     */
    origin: string;
    /**
     * Represents the unique identifier for a credential.
     * This variable identifies a specific credential within the authenticator.
     */
    credId: string;
    /**
     * An optional configuration object that specifies options for a PublicKeyCredential request.
     *
     * This object is used during the process of requesting a credential from the user's device
     * for Web Authentication (WebAuthn). It allows customization of the request to match
     * the application's authentication requirements.
     *
     * Property details of `PublicKeyCredentialRequestOptions` typically include:
     * - `timeout`: The time, in milliseconds, that the user agent is expected to wait for a response.
     * - `userVerification`: Specifies the level of user verification required (e.g., "required", "preferred", "discouraged").
     *
     * This parameter is optional when calling authentication-related functions. If omitted,
     * the request may rely on default or previously established options.
     */
    options?: PublicKeyCredentialRequestOptions;
    /**
     * A boolean flag to enable or disable debug mode.
     * If set to `true`, the application may output additional
     * logging or diagnostic information useful for debugging.
     * Defaults to `false` if not specified.
     */
    debug?: boolean;
};
/**
 * Assert a known credential
 *
 * Handles both {@link fetch.postOptions} and {@link fetch.postResponse} for the caller.
 * This includes encoding/decoding the payloads from the service and navigator api.
 *
 * #### Quick Start:
 * {@includeCode ./assertion.spec.ts#assertionImport,quickStart}
 *
 *
 * @param {AssertionOptions} params
 */
export declare function assertion(params: AssertionOptions): Promise<any>;
