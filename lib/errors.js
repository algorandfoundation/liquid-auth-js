const INVALID_INPUT_MESSAGE = "Invalid input";
const INVALID_RESPONSE_MESSAGE = "Invalid response";
const CREDENTIAL_ACTION_FAILURE = "Credential action failed";
const UNSIGNED_MESSAGE = "Message must be signed";
const AUTHENTICATOR_NOT_SUPPORTED_MESSAGE = "Authenticator not supported";
const REQUEST_IS_MISSING_MESSAGE = "Request id is required";
const REQUEST_IN_PROCESS_MESSAGE = "Request in process";
const UNAUTHENTICATED_MESSAGE = "Not authenticated";
const ORIGIN_IS_MISSING_MESSAGE = "Origin is required";
class ServiceError extends Error {
}
function isValidResponse(r) {
  return r.ok && (r.status === 200 || r.status === 201);
}
export {
  AUTHENTICATOR_NOT_SUPPORTED_MESSAGE,
  CREDENTIAL_ACTION_FAILURE,
  INVALID_INPUT_MESSAGE,
  INVALID_RESPONSE_MESSAGE,
  ORIGIN_IS_MISSING_MESSAGE,
  REQUEST_IN_PROCESS_MESSAGE,
  REQUEST_IS_MISSING_MESSAGE,
  ServiceError,
  UNAUTHENTICATED_MESSAGE,
  UNSIGNED_MESSAGE,
  isValidResponse
};
//# sourceMappingURL=errors.js.map
