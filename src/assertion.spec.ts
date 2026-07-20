import { describe, it, beforeAll, expect, vi } from "vitest";
import { createMocks } from "./test/test.config";
// #region assertionImport
import { assertion } from "@algorandfoundation/liquid-client/assertion";
// #endregion assertionImport

import requestParamFixtures from "../__fixtures__/assertion.request.param.fixtures.json";
import responseResponseFixtures from "../__fixtures__/assertion.response.response.fixtures.json";
import { INVALID_INPUT_MESSAGE } from "./errors";

describe("assertion", async () => {
  beforeAll(async () => {
    createMocks();
  });
  it("(OK) should provide an example", async () => {
    // Smoke Test/Documentation
    // #region quickStart
    const credentialId =
      "AYMPi2Rbhcnu2gSHOO1TNvzDJ38iU00rrlCqyH874XCIEoIotRc7eVRFpx0TvsQurg7BAnXy5KnWdKC8LeWs0k0";
    const response = await assertion({
      origin: "http://localhost:0", // service to authenticate with
      credId: credentialId, // Some known credential ID
      debug: true, // Display log
    });
    // #endregion quickStart

    expect(response).toBeDefined();
  });
  // Table Tests
  it("(OK) should assert a credential", async () => {
    await Promise.all(
      requestParamFixtures.map(async (credId, index) => {
        const response = await assertion({
          origin: `"https://example-site:${index}"`,
          credId: credId,
        });
        expect(response).toEqual(responseResponseFixtures[index]);
      }),
    );
  });

  it("(OK) should override options", async () => {
    const response = await assertion({
      origin: `"https://example-site:0"`,
      credId: requestParamFixtures[0],
      options: {
        challenge: "MFRXdS1HNGl1M3NiQVFvcGhlb1BlX0NwbkxKT0ItUWxJVXZ3RkJDMzE3USIs",
        allowCredentials: [],
      },
    });
    expect(response).toEqual(null);
  });

  it("(OK) should request a challenge bound to a durable pairing", async () => {
    const credId = requestParamFixtures[0];
    const requestId = "019097ff-bb8d-7f68-9062-89543625aca5";

    await assertion({
      origin: "https://example-site:0",
      credId,
      requestOptions: { requestId },
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `https://example-site:0/assertion/request/${credId}`,
      expect.objectContaining({ body: JSON.stringify({ requestId }) }),
    );
    const responseCall = vi
      .mocked(globalThis.fetch)
      .mock.calls.filter(([input]) => String(input).endsWith("/assertion/response"))
      .at(-1);
    expect(JSON.parse(String(responseCall?.[1]?.body))).toMatchObject({
      clientExtensionResults: { liquid: { requestId } },
    });
  });

  describe("Negative Tests", async () => {
    it("(FAIL) should not accept invalid parameters", async () => {
      await expect(() =>
        // @ts-expect-error, testing invalid input
        assertion(undefined),
      ).rejects.toThrow(INVALID_INPUT_MESSAGE);
      await expect(() =>
        assertion({
          // @ts-expect-error, testing invalid input
          origin: undefined,
          credId: "CREDENTIAL",
        }),
      ).rejects.toThrow(INVALID_INPUT_MESSAGE);
    });
  });
});
