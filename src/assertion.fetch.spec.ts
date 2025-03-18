import { describe, it, beforeAll, expect } from 'vitest';
import { createMockFetch, createMocks } from '../test/test.config';
// #region assertionImport
import { assertion } from '@algorandfoundation/liquid-client';
import type { EncodedCredential } from '@algorandfoundation/liquid-client/assertion/encoder';
// #endregion assertionImport

import requestParamFixtures from '../__fixtures__/assertion.request.param.fixtures.json';
import requestResponseFixtures from '../__fixtures__/assertion.request.response.fixtures.json';
import { INVALID_INPUT_MESSAGE, INVALID_RESPONSE_MESSAGE } from './errors';

describe('assertion/fetch', async () => {
  beforeAll(async () => {
    createMocks();
  });
  it('(OK) should have a valid example', async () => {
    // Smoke Test/Documentation
    // #region guideOptions
    // A previously known Credential ID
    const credentialId =
      'AYMPi2Rbhcnu2gSHOO1TNvzDJ38iU00rrlCqyH874XCIEoIotRc7eVRFpx0TvsQurg7BAnXy5KnWdKC8LeWs0k0';
    // Encoded options that must be decoded before submitting to the Credential API
    const encodedOptions = await assertion.fetch.postOptions(
      'http://localhost:0',
      credentialId,
    );
    // #endregion guideOptions

    // #region guideCredentialGet
    // Fetch the Credential from the Credential Api
    const credential = await navigator.credentials.get({
      publicKey: assertion.encoder.decodeOptions(encodedOptions),
    });
    // Encode the Credential for sending to the service
    const encodedCredential: EncodedCredential =
      assertion.encoder.encodeCredential(credential);
    // #endregion guideCredentialGet

    // #region guideResponse
    // Receive the response from the Authentication Service
    const response = await assertion.fetch.postResponse(
      'http://localhost:0',
      encodedCredential,
    );
    // #endregion guideResponse

    expect(response).toBeDefined();
  });
  // Table Tests
  it('(OK) should assert a credential', async () => {
    await Promise.all(
      requestParamFixtures.map(async (credId, index) => {
        const response = await assertion.fetch.postOptions(
          `https://localhost:${index}`,
          credId,
        );
        expect(response).toEqual(requestResponseFixtures[index]);
      }),
    );
  });
  // Negative Tests
  describe('Negative Tests', async () => {
    beforeAll(() => {
      //@ts-expect-error, mocking fetch
      globalThis.fetch = createMockFetch(false, true);
    });
    it('(FAIL) should not accept invalid options', async () => {
      await expect(() =>
        // @ts-expect-error, testing purposes
        assertion.fetch.postOptions(undefined, undefined),
      ).rejects.toThrow(INVALID_INPUT_MESSAGE);
    });
    it('(FAIL) should not accept invalid option responses', async () => {
      await expect(() =>
        assertion.fetch.postOptions('ORIGIN', ''),
      ).rejects.toThrow(INVALID_RESPONSE_MESSAGE);
    });

    it('(FAIL) should not accept invalid responses', async () => {
      await expect(() =>
        // @ts-expect-error, testing purposes
        assertion.fetch.postResponse(undefined, undefined),
      ).rejects.toThrow(INVALID_INPUT_MESSAGE);
    });
    it('(FAIL) should not accept invalid response responses', async () => {
      await expect(() =>
        assertion.fetch.postResponse(
          'http://ORIGIN:0',
          {} as EncodedCredential,
        ),
      ).rejects.toThrow(INVALID_RESPONSE_MESSAGE);
    });
  });
});
