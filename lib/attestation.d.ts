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
export declare function attestation(params: AttestationOptions): Promise<any>;
