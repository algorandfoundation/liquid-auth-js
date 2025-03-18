/**
 * @module errors
 * @protected
 */
/**
 * A constant string that represents the message to be displayed or used
 * when an invalid input is encountered in the application.
 *
 * This message is intended to provide a clear indication to the user or
 * developer that an input provided does not meet the required criteria
 * or expectations.
 *
 * @protected
 */
export declare const INVALID_INPUT_MESSAGE = "Invalid input";
/**
 * A constant string representing a default message for an invalid response.
 * This can be used to indicate that a response does not meet the expected format
 * or criteria in validation processes or error handling.
 *
 * @protected
 */
export declare const INVALID_RESPONSE_MESSAGE = "Invalid response";
/**
 * Represents the error message indicating that a credential-related action has failed.
 * This constant is typically used to signal or log failure scenarios where operations
 * associated with credentials do not succeed.
 *
 * @protected
 */
export declare const CREDENTIAL_ACTION_FAILURE = "Credential action failed";
/**
 * A constant string representing an error or validation message indicating that
 * the message must be signed.
 *
 * This constant is used in scenarios where a signed message is required for
 * security, validation, or processing purposes.
 *
 * @protected
 */
export declare const UNSIGNED_MESSAGE = "Message must be signed";
export declare const AUTHENTICATOR_NOT_SUPPORTED_MESSAGE = "Authenticator not supported";
export declare const REQUEST_IS_MISSING_MESSAGE = "Request id is required";
export declare const REQUEST_IN_PROCESS_MESSAGE = "Request in process";
export declare const UNAUTHENTICATED_MESSAGE = "Not authenticated";
export declare const ORIGIN_IS_MISSING_MESSAGE = "Origin is required";
export declare class ServiceError extends Error {
}
export declare function isValidResponse(r: Response): boolean;
