import { bench } from "vitest";
import { createMocks } from "./test/test.config";

// Fixtures
import requestParamFixtures from "../__fixtures__/assertion.request.param.fixtures.json";
import requestResponseFixtures from "../__fixtures__/assertion.request.response.fixtures.json";
import responseBodyFixtures from "../__fixtures__/assertion.response.body.fixtures.json";

// Library
import { assertion, fetch, encoder } from "./assertion";
import { fromBase64Url } from "./encoding";

// Setup Benchmarks
const TEST_ORIGIN = "http://localhost:5173";
createMocks();

bench(
  "assertion",
  async () => {
    await assertion({
      origin: TEST_ORIGIN,
      credId: requestParamFixtures[0],
    });
  },
  { time: 100, throws: true },
);

bench(
  "assertion.fetch.postOptions",
  async () => {
    await fetch.postOptions(TEST_ORIGIN, requestParamFixtures[0]);
  },
  { time: 100, throws: true },
);

bench(
  "assertion.fetch.postResponse",
  async () => {
    await fetch.postResponse(
      TEST_ORIGIN,
      requestResponseFixtures[0] as any,
    );
  },
  { time: 100, throws: true },
);

bench(
  "assertion.encoder.encodeCredential",
  () => {
    encoder.encodeCredential({
      ...responseBodyFixtures[0],
      getClientExtensionResults: () => responseBodyFixtures[0].clientExtensionResults,
      response: {
        ...responseBodyFixtures[0].response,
        authenticatorData: fromBase64Url(responseBodyFixtures[0].response.authenticatorData),
        clientDataJSON: fromBase64Url(responseBodyFixtures[0].response.clientDataJSON),
        signature: fromBase64Url(responseBodyFixtures[0].response.signature),
      },
    } as any);
  },
  { time: 100, throws: true },
);

bench(
  "assertion.encoder.decodeOptions",
  () => {
    encoder.decodeOptions(
      requestResponseFixtures[0] as any,
    );
  },
  { time: 100, throws: true },
);
