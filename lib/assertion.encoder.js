import { INVALID_INPUT_MESSAGE, CREDENTIAL_ACTION_FAILURE } from "./errors.js";
import { toBase64URL, fromBase64Url } from "./encoding.js";
function encodeResponse(response) {
  return Object.keys(
    AuthenticatorAssertionResponse.prototype
  ).reduce(
    (prev, curr) => {
      prev[curr] = toBase64URL(response[curr]);
      return prev;
    },
    {
      clientDataJSON: toBase64URL(response.clientDataJSON)
    }
  );
}
function decodeOptions(options) {
  var _a;
  if (typeof options !== "object" || typeof options.challenge !== "string")
    throw new TypeError(INVALID_INPUT_MESSAGE);
  const decodedOptions = { ...options };
  decodedOptions.challenge = fromBase64Url(options.challenge);
  decodedOptions.allowCredentials = ((_a = options.allowCredentials) == null ? void 0 : _a.map(
    (cred) => {
      return {
        ...cred,
        id: fromBase64Url(cred.id)
      };
    }
  )) || [];
  return decodedOptions;
}
function encodeCredential(credential) {
  if (!credential) throw new Error(INVALID_INPUT_MESSAGE);
  const response = credential.response;
  if (!response) throw new Error(CREDENTIAL_ACTION_FAILURE);
  return {
    id: credential.id,
    type: credential.type,
    rawId: toBase64URL(credential.rawId),
    response: encodeResponse(response)
  };
}
export {
  decodeOptions,
  encodeCredential,
  encodeResponse
};
//# sourceMappingURL=assertion.encoder.js.map
