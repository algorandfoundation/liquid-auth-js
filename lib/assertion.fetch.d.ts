import { EncodedPublicKeyCredentialRequestOptions, EncodedCredential } from './assertion.encoder.js';
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
export declare function postOptions(origin: string, credId: string): Promise<EncodedPublicKeyCredentialRequestOptions>;
/**
 * Fetch Assertion Response
 *
 * POST an Authenticator Assertion Response to the REST API
 *
 * @param origin
 * @param credential
 * @todo: Generate Typed JSON-RPC clients from Swagger/OpenAPI
 */
export declare function postResponse(origin: string, credential: EncodedCredential): Promise<any>;
