import { vi, type Mock } from "vitest";
import { fromBase64Url, toBase64URL } from "../src/encoding.js";
import type { PublicKeyCredentialRequestOptions } from "@simplewebauthn/browser";

import getRequestParamFixtures from "../__fixtures__/assertion.request.param.fixtures.json";
import getRequestResponseFixtures from "../__fixtures__/assertion.request.response.fixtures.json";
import getResponseBodyFixtures from "../__fixtures__/assertion.response.body.fixtures.json";
import getResponseResponseFixtures from "../__fixtures__/assertion.response.response.fixtures.json";

import createRequestResponseFixtures from "../__fixtures__/attestation.request.response.fixtures.json";
import createResponseBodyFixtures from "../__fixtures__/attestation.response.body.fixtures.json";
import createResponseResponseFixtures from "../__fixtures__/attestation.response.response.fixtures.json";

export function createMocks(): void {
  if (!globalThis.navigator?.credentials) {
    if (!globalThis.navigator) (globalThis.navigator as any) = {};
    (globalThis.navigator.credentials as any) = {};

    class AuthenticatorAssertionResponse {
      attestationObject: string = "";
      authenticatorData: ArrayBuffer = new ArrayBuffer(0);
      clientDataJSON: ArrayBuffer = new ArrayBuffer(0);
      publicKey: string = "";
      publicKeyAlgorithm: number = -7;
      transports: string[] = [];
      signature: ArrayBuffer = new ArrayBuffer(0);
      userHandle: ArrayBuffer = new ArrayBuffer(0);
    }

    (globalThis as any).AuthenticatorAssertionResponse = AuthenticatorAssertionResponse;
  }
  //@ts-expect-error, for testing reasons
  globalThis.navigator.credentials.get = vi.fn(
    (options: { publicKey: PublicKeyCredentialRequestOptions }) => {
      if (!options.publicKey) throw new Error("Publickey supported only");
      if (!options.publicKey.allowCredentials) throw new Error("allowCredentials is required");
      const credId = toBase64URL(options.publicKey.allowCredentials[0].id as Uint8Array);
      const responseBody = getResponseBodyFixtures.find((f) => f.id === credId);
      if (!responseBody) {
        throw new Error("No response found");
      }
      return Promise.resolve({
        ...responseBody,
        rawId: fromBase64Url(responseBody.rawId),
        response: {
          authenticatorData: fromBase64Url(responseBody.response.authenticatorData),
          clientDataJSON: fromBase64Url(responseBody.response.clientDataJSON),
        },
        type: "public-key",
        getClientExtensionResults: () => responseBody.clientExtensionResults,
      });
    },
  );

  globalThis.navigator.credentials.create = vi.fn((options: CredentialCreationOptions) => {
    if (!options.publicKey) throw new Error("Publickey supported only");
    const user = options.publicKey.user.name;
    const responseBody = createResponseBodyFixtures.find(
      (f) => f.clientExtensionResults.liquid.address === user,
    );
    if (!responseBody) {
      throw new Error("No response found");
    }
    return Promise.resolve({
      ...responseBody,
      id: responseBody.id,
      rawId: fromBase64Url(responseBody.id),
      response: {
        clientDataJSON: fromBase64Url(responseBody.response.clientDataJSON),
        attestationObject: fromBase64Url(responseBody.response.attestationObject),
      },
      type: "public-key",
      getClientExtensionResults: () => responseBody.clientExtensionResults,
    });
  });

  //@ts-expect-error, for testing reasons
  globalThis.fetch = createMockFetch();
}

export function createMockFetch(
  throws = false,
  invalid = false,
): Mock<
  (
    url: any,
    opts: any,
  ) => Promise<{
    ok: boolean;
    status: number;
    statusText: string;
    json: () => Promise<any>;
  }>
> {
  return vi.fn((url, opts) => {
    let json: any;
    if (throws) return Promise.reject(new Error("Error"));
    if (opts.body) {
      if (url.includes("attestation/request")) {
        const index = parseInt(url.split(":")[2].replace("/attestation/request", ""));
        json = createRequestResponseFixtures[index];
      }
      if (url.includes("attestation/response")) {
        const index = parseInt(url.split(":")[2].replace("/attestation/response", ""));
        json = createResponseResponseFixtures[index];
      }

      if (url.includes("assertion/response")) {
        const index = parseInt(url.split(":")[2].replace("/assertion/response", ""));
        json = getResponseResponseFixtures[index];
      }
    }

    if (url.includes("assertion/request")) {
      const paths = url.split("/");
      const id = paths[paths.length - 1];
      json = getRequestResponseFixtures[getRequestParamFixtures.findIndex((f) => f === id)];
    }

    return Promise.resolve({
      ok: !invalid,
      status: invalid ? 401 : 200,
      statusText: invalid ? "ERROR" : "OK",
      json: () => Promise.resolve(json),
    });
  });
}
