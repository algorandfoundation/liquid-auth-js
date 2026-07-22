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
export const INVALID_INPUT_MESSAGE = "Invalid input";

/**
 * A constant string representing a default message for an invalid response.
 * This can be used to indicate that a response does not meet the expected format
 * or criteria in validation processes or error handling.
 *
 * @protected
 */
export const INVALID_RESPONSE_MESSAGE = "Invalid response";
/**
 * Represents the error message indicating that a credential-related action has failed.
 * This constant is typically used to signal or log failure scenarios where operations
 * associated with credentials do not succeed.
 *
 * @protected
 */
export const CREDENTIAL_ACTION_FAILURE = "Credential action failed";

/**
 * A constant string representing an error or validation message indicating that
 * the message must be signed.
 *
 * This constant is used in scenarios where a signed message is required for
 * security, validation, or processing purposes.
 *
 * @protected
 */
export const UNSIGNED_MESSAGE = "Message must be signed";

export const AUTHENTICATOR_NOT_SUPPORTED_MESSAGE = "Authenticator not supported";
export const REQUEST_IS_MISSING_MESSAGE = "Request id is required";
export const REQUEST_IN_PROCESS_MESSAGE = "Request in process";
export const UNAUTHENTICATED_MESSAGE = "Not authenticated";
export const ORIGIN_IS_MISSING_MESSAGE = "Origin is required";

export class ServiceError extends Error {}

/**
 * The reasons a Liquid Auth signaling server can refuse to admit a device to a
 * `requestId` room under the two-peer room policy (one wallet `admin` + one
 * non-admin `peer`, max two devices). Mirrors the `reason` field the gateway
 * puts on the payload of the `link-error` `WsException` it throws.
 *
 * @protected
 */
export type LinkErrorReason = "room-full" | "duplicate-admin" | "duplicate-peer";

/**
 * Raised when the signaling server refuses a `link` request — e.g. the
 * `requestId` room is already full, or already holds a device of the same
 * role.
 *
 * NestJS delivers the gateway's `WsException` as a generic `exception` event
 * (its default WS exception filter does NOT invoke the `link` ack), so
 * {@link SignalClient.link} listens for it and translates a refusal into a
 * rejected promise carrying this typed error. Callers can then distinguish a
 * deterministic room refusal (retrying cannot help) from a plain signaling
 * timeout (the peer may simply not be linked yet).
 *
 * @protected
 */
export class LinkError extends ServiceError {
  /** Machine-readable refusal reason, when the server supplied one. */
  readonly reason?: LinkErrorReason;
  /** The `requestId` the refused link was for, when known. */
  readonly requestId?: string;

  constructor(
    message: string,
    opts?: { reason?: LinkErrorReason; requestId?: string },
  ) {
    super(message);
    this.name = "LinkError";
    this.reason = opts?.reason;
    this.requestId = opts?.requestId;
    // Preserve `instanceof LinkError` even when the class is extended or the
    // build target down-levels `extends Error` (which otherwise resets the
    // prototype chain).
    Object.setPrototypeOf(this, LinkError.prototype);
  }
}

export function isValidResponse(r: Response): boolean {
  return r.ok && (r.status === 200 || r.status === 201);
}
