import { toBase64URL, decodeAddress, fromBase64Url } from "./encoding.js";
function encodeCredential(credential) {
  const response = credential.response;
  return {
    id: credential.id,
    rawId: toBase64URL(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: toBase64URL(response.clientDataJSON),
      attestationObject: toBase64URL(response.attestationObject)
    }
  };
}
function decodeOptions(options, liquidOptions) {
  const attestationOptions = { ...options };
  attestationOptions.user.id = decodeAddress(liquidOptions.address);
  attestationOptions.user.name = liquidOptions.address;
  attestationOptions.user.displayName = liquidOptions.address;
  attestationOptions.challenge = fromBase64Url(options.challenge);
  if (attestationOptions.excludeCredentials) {
    for (const cred of attestationOptions.excludeCredentials) {
      cred.id = fromBase64Url(cred.id);
    }
  }
  return attestationOptions;
}
export {
  decodeOptions,
  encodeCredential
};
//# sourceMappingURL=attestation.encoder.js.map
