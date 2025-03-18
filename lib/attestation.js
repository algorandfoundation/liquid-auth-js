import { fromBase64Url } from "./encoding.js";
import { AUTHENTICATOR_NOT_SUPPORTED_MESSAGE, INVALID_INPUT_MESSAGE } from "./errors.js";
import { DEFAULT_ATTESTATION_OPTIONS, postOptions, postResponse } from "./attestation.fetch.js";
import * as attestation_fetch from "./attestation.fetch.js";
import { decodeOptions, encodeCredential } from "./attestation.encoder.js";
import * as attestation_encoder from "./attestation.encoder.js";
async function attestation(params) {
  if (typeof navigator === "undefined")
    throw new Error(AUTHENTICATOR_NOT_SUPPORTED_MESSAGE);
  if (typeof params === "undefined") throw new Error(INVALID_INPUT_MESSAGE);
  const {
    origin,
    onChallenge,
    options = DEFAULT_ATTESTATION_OPTIONS,
    debug
  } = params;
  if (typeof origin !== "string") {
    throw new TypeError(INVALID_INPUT_MESSAGE);
  }
  debug && console.log(
    `%cFETCHING: %c/attestation/request/`,
    "color: yellow",
    "color: cyan"
  );
  const credentialOptions = await postOptions(origin, options);
  debug && console.log(
    "%cHANDLE_SIGNATURE:%c onChallenge",
    "color: yellow",
    "color: cyan",
    "*".repeat(credentialOptions.challenge.length)
  );
  const liquidOptions = await onChallenge(
    fromBase64Url(credentialOptions.challenge)
  );
  debug && console.log(
    "%cDECODE:%c assertion.encoder.decodeOptions",
    "color: yellow",
    "color: cyan",
    "*".repeat(liquidOptions.signature.length)
  );
  const mergedOptions = decodeOptions(credentialOptions, liquidOptions);
  const credential = await navigator.credentials.create({
    publicKey: mergedOptions
  }).then(encodeCredential);
  credential.clientExtensionResults = { liquid: liquidOptions };
  debug && console.log(
    "%cPOSTING: %c/attestation/response",
    "color: yellow",
    "color: cyan",
    credential
  );
  return await postResponse(origin, credential);
}
export {
  attestation,
  attestation_encoder as encoder,
  attestation_fetch as fetch
};
//# sourceMappingURL=attestation.js.map
