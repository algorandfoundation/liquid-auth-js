import { postOptions, postResponse } from "./assertion.fetch.js";
import * as assertion_fetch from "./assertion.fetch.js";
import { decodeOptions, encodeCredential } from "./assertion.encoder.js";
import * as assertion_encoder from "./assertion.encoder.js";
import { AUTHENTICATOR_NOT_SUPPORTED_MESSAGE, INVALID_INPUT_MESSAGE } from "./errors.js";
async function assertion(params) {
  var _a;
  if (typeof navigator === "undefined")
    throw new Error(AUTHENTICATOR_NOT_SUPPORTED_MESSAGE);
  if (typeof params === "undefined") throw new Error(INVALID_INPUT_MESSAGE);
  const { origin, credId, options, debug } = params;
  if (typeof credId !== "string" || typeof origin !== "string") {
    throw new TypeError(INVALID_INPUT_MESSAGE);
  }
  debug && console.log(
    `%cFETCHING: %c/assertion/request/${credId}`,
    "color: yellow",
    "color: cyan"
  );
  const credentialOptions = typeof options !== "undefined" ? options : await postOptions(origin, credId).then(decodeOptions);
  if (((_a = credentialOptions.allowCredentials) == null ? void 0 : _a.length) === 0) {
    debug && console.info("No registered credentials found.");
    return null;
  }
  debug && console.log(
    "%cGET_CREDENTIAL:%c navigator.credentials.get",
    "color: yellow",
    "color: cyan",
    options
  );
  const credential = await navigator.credentials.get({
    publicKey: credentialOptions
  }).then(encodeCredential);
  debug && console.log(
    "%cPOSTING: %c/assertion/response",
    "color: yellow",
    "color: cyan",
    credential
  );
  return postResponse(origin, credential);
}
export {
  assertion,
  assertion_encoder as encoder,
  assertion_fetch as fetch
};
//# sourceMappingURL=assertion.js.map
