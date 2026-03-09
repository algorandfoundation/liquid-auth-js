export {
  decodeAddress,
  encodeAddress,
} from '@algorandfoundation/algokit-utils';

const chars =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/**
 * A constant string containing the error message for a malformed address.
 * This message is used to indicate that an address does not adhere to the expected format or structure.
 *
 * @protected
 */
export const MALFORMED_ADDRESS_ERROR_MSG = 'Malformed address';

/**
 * A constant string that represents an error message for an Algorand address with a bad checksum.
 * This message is used to indicate that the checksum of the provided Algorand address is invalid,
 * which typically occurs when the address is incorrectly formed or corrupted.
 *
 * @protected
 */
export const ALGORAND_ADDRESS_BAD_CHECKSUM_ERROR_MSG = 'Bad checksum';
/**
 * A constant string representing an error message for invalid base64url input.
 * This value is used to indicate that the provided input does not conform to the
 * expected base64url format or specification.
 *
 * @protected
 */
export const INVALID_BASE64URL_INPUT = 'Invalid base64url input';

/**
 * Converts a given Uint8Array or ArrayBuffer to a Base64 URL-safe encoded string.
 *
 * @param {Uint8Array | ArrayBuffer} arr - The input data to be converted to a Base64 URL-safe string.
 * @return {string} A Base64 URL-safe encoded string representation of the input data.
 */
export function toBase64URL(arr: Uint8Array | ArrayBuffer): string {
  const bytes = arr instanceof Uint8Array ? arr : new Uint8Array(arr);
  const len = bytes.length;
  let base64 = '';
  for (let i = 0; i < len; i += 3) {
    base64 += chars[bytes[i] >> 2];
    base64 += chars[((bytes[i] & 3) << 4) | (bytes[i + 1] >> 4)];
    base64 += chars[((bytes[i + 1] & 15) << 2) | (bytes[i + 2] >> 6)];
    base64 += chars[bytes[i + 2] & 63];
  }

  if (len % 3 === 2) {
    base64 = base64.substring(0, base64.length - 1);
  } else if (len % 3 === 1) {
    base64 = base64.substring(0, base64.length - 2);
  }

  return base64;
}

/**
 * Converts a Base64 URL-encoded string into a Uint8Array.
 *
 * @param {string} base64url - The Base64 URL-encoded string to be converted.
 * This string must be a valid Base64 URL-safe format.
 * @return {Uint8Array} A Uint8Array representing the decoded binary data from the input Base64 URL string.
 * @throws {Error} If the provided input is not a string or is an invalid Base64 URL format.
 */
export function fromBase64Url(base64url: string): Uint8Array {
  if (typeof base64url !== 'string') {
    throw new Error(INVALID_BASE64URL_INPUT);
  }
  return new Uint8Array(
    // TODO: Cross-platform solution since atob is deprecated in Node
    atob(base64url.replace(/-/g, '+').replace(/_/g, '/').replace(/\s/g, ''))
      .split('')
      .map((c) => c.charCodeAt(0)),
  );
}