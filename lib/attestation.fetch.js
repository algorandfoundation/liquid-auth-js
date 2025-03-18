import { DEFAULT_FETCH_OPTIONS } from "./constants.js";
import { isValidResponse } from "./errors.js";
const DEFAULT_ATTESTATION_OPTIONS = {
  attestationType: "none",
  authenticatorSelection: {
    authenticatorAttachment: "platform",
    userVerification: "required",
    requireResidentKey: false
  },
  extensions: {
    liquid: true
  }
};
async function postOptions(origin, options = DEFAULT_ATTESTATION_OPTIONS) {
  return await fetch(`${origin}/attestation/request`, {
    ...DEFAULT_FETCH_OPTIONS,
    body: JSON.stringify(options)
  }).then((r) => {
    if (!isValidResponse(r)) throw new Error(r.statusText);
    return r.json();
  });
}
async function postResponse(origin, credential) {
  return await fetch(`${origin}/attestation/response`, {
    ...DEFAULT_FETCH_OPTIONS,
    body: JSON.stringify(credential)
  }).then((r) => {
    if (!isValidResponse(r)) throw new Error(r.statusText);
    return r.json();
  });
}
export {
  DEFAULT_ATTESTATION_OPTIONS,
  postOptions,
  postResponse
};
//# sourceMappingURL=attestation.fetch.js.map
