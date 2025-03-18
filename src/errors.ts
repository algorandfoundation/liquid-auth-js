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
export const INVALID_INPUT_MESSAGE = 'Invalid input';

/**
 * A constant string representing a default message for an invalid response.
 * This can be used to indicate that a response does not meet the expected format
 * or criteria in validation processes or error handling.
 *
 * @protected
 */
export const INVALID_RESPONSE_MESSAGE = 'Invalid response';
/**
 * Represents the error message indicating that a credential-related action has failed.
 * This constant is typically used to signal or log failure scenarios where operations
 * associated with credentials do not succeed.
 *
 * @protected
 */
export const CREDENTIAL_ACTION_FAILURE = 'Credential action failed';

/**
 * A constant string representing an error or validation message indicating that
 * the message must be signed.
 *
 * This constant is used in scenarios where a signed message is required for
 * security, validation, or processing purposes.
 *
 * @protected
 */
export const UNSIGNED_MESSAGE = 'Message must be signed';

export const AUTHENTICATOR_NOT_SUPPORTED_MESSAGE =
  'Authenticator not supported';
export const REQUEST_IS_MISSING_MESSAGE = 'Request id is required';
export const REQUEST_IN_PROCESS_MESSAGE = 'Request in process';
export const UNAUTHENTICATED_MESSAGE = 'Not authenticated';
export const ORIGIN_IS_MISSING_MESSAGE = 'Origin is required';

export class ServiceError extends Error {}

export function isValidResponse(r: Response) {
  return r.ok && (r.status === 200 || r.status === 201);
}
