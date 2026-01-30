import { INVALID_INPUT_MESSAGE, isValidResponse, INVALID_RESPONSE_MESSAGE } from "./errors.js";
import { DEFAULT_FETCH_OPTIONS } from "./constants.js";
async function postOptions(origin, credId) {
  if (typeof origin !== "string" || typeof credId !== "string") {
    throw new TypeError(INVALID_INPUT_MESSAGE);
  }
  return await fetch(`${origin}/assertion/request/${credId}`, {
    ...DEFAULT_FETCH_OPTIONS
  }).then((r) => {
    if (!isValidResponse(r)) {
      throw new Error(INVALID_RESPONSE_MESSAGE);
    }
    return r.json();
  });
}
async function postResponse(origin, credential) {
  if (typeof origin !== "string" || typeof credential !== "object") {
    throw new TypeError(INVALID_INPUT_MESSAGE);
  }
  return await fetch(`${origin}/assertion/response`, {
    ...DEFAULT_FETCH_OPTIONS,
    body: JSON.stringify(credential)
  }).then((r) => {
    if (!isValidResponse(r)) {
      throw new Error(INVALID_RESPONSE_MESSAGE);
    }
    return r.json();
  });
}
export {
  postOptions,
  postResponse
};
//# sourceMappingURL=assertion.fetch.js.map
