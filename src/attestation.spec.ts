import { describe, it, beforeAll, expect } from 'vitest';
import { createMocks } from '../test/test.config';
// #region import
import { attestation } from '@algorandfoundation/liquid-client/attestation';
// #endregion import

import requestBodyFixtures from '../__fixtures__/attestation.request.body.fixtures.json';
import responseBodyFixtures from '../__fixtures__/attestation.response.body.fixtures.json';
import responseResponseFixtures from '../__fixtures__/attestation.response.response.fixtures.json';
import { INVALID_INPUT_MESSAGE } from './errors';

describe('attestation', async () => {
  beforeAll(async () => {
    createMocks();
    // Smoke Test/Documentation
    // #region quickStart

    // #endregion quickStart
  });
  it('(OK) should provide an example', async () => {
    const response = await attestation({
      origin: 'https://example-site:0', // Update to the origin of the FIDO service
      onChallenge: async () => {
        return responseBodyFixtures[0].clientExtensionResults.liquid;
      },
      debug: true, // Enable logs
    });
    expect(response).toEqual(responseResponseFixtures[0]);
  });
  // Table Tests
  it('(OK) should create a credential', async () => {
    await Promise.all(
      requestBodyFixtures.map(async (_, index) => {
        const response = await attestation({
          origin: `"https://example-site:${index}"`, // Update to the origin of the FIDO service
          onChallenge: async () => {
            return responseBodyFixtures[index].clientExtensionResults.liquid;
          },
        });
        expect(response).toEqual(responseResponseFixtures[index]);
      }),
    );
  });
  describe('Negative Tests', async () => {
    it('(FAIL) should not accept invalid parameters', async () => {
      await expect(() =>
        // @ts-expect-error, testing purposes
        attestation(undefined),
      ).rejects.toThrow(INVALID_INPUT_MESSAGE);
      await expect(() =>
        attestation({
          //@ts-expect-error, testing purposes
          origin: undefined,
        }),
      ).rejects.toThrow(INVALID_INPUT_MESSAGE);
    });
  });
});
