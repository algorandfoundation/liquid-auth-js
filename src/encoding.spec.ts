import { test, expect } from 'vitest';

import { toBase64URL, fromBase64Url } from './encoding.js';

import {
  encodeAddress,
  decodeAddress,
  INVALID_BASE64URL_INPUT,
  MALFORMED_ADDRESS_ERROR_MSG,
  ALGORAND_ADDRESS_BAD_CHECKSUM_ERROR_MSG,
} from './encoding.js';
import base64UrlFixtures from '../__fixtures__/encoding.base64url.fixtures.json';
import walletKeysFixtures from '../__fixtures__/wallet.keys.fixtures.json';

// Invalid Inputs
test(`fromBase64URL(*) throws ${INVALID_BASE64URL_INPUT}`, function () {
  expect(() =>
    // @ts-expect-error, required for testing
    fromBase64Url(12345),
  ).toThrow(new Error(INVALID_BASE64URL_INPUT));
});
test(`toBase64URL`, () => {
  base64UrlFixtures.forEach((fixture, i) => {
    const encoder = new TextEncoder();
    expect(
      toBase64URL(
        i % 2
          ? encoder.encode(fixture.origin)
          : (fixture.fromBase64Url as unknown as Uint8Array),
      ),
    ).toEqual(fixture.toBase64Url);

    expect(fromBase64Url(fixture.toBase64Url)).toEqual(
      new Uint8Array(fixture.fromBase64Url),
    );
  });
});

// Test Basic Inputs
test(`decodeAddress(*) throws ${MALFORMED_ADDRESS_ERROR_MSG}`, function () {
  expect(() =>
    // @ts-expect-error, required for testing
    decodeAddress(12345),
  ).toThrow(new Error(MALFORMED_ADDRESS_ERROR_MSG));
});
// Algorand Address Tests
test('addressEncoder', function () {
  walletKeysFixtures.forEach(function (fixture) {
    // #region decodeAddress
    const decoded = decodeAddress(fixture.encoded);
    // #endregion decodeAddress
    expect(decoded).toEqual(new Uint8Array(fixture.publicKey));

    const address = encodeAddress(new Uint8Array(fixture.publicKey));
    expect(address).toEqual(fixture.encoded);

    expect(() => decodeAddress(fixture.encoded.slice(0, -4) + '====')).toThrow(
      new Error(ALGORAND_ADDRESS_BAD_CHECKSUM_ERROR_MSG),
    );
  });
});
