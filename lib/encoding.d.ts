/**
 * A constant string containing the error message for a malformed address.
 * This message is used to indicate that an address does not adhere to the expected format or structure.
 *
 * @protected
 */
export declare const MALFORMED_ADDRESS_ERROR_MSG = "Malformed address";
/**
 * A constant string that represents an error message for an Algorand address with a bad checksum.
 * This message is used to indicate that the checksum of the provided Algorand address is invalid,
 * which typically occurs when the address is incorrectly formed or corrupted.
 *
 * @protected
 */
export declare const ALGORAND_ADDRESS_BAD_CHECKSUM_ERROR_MSG = "Bad checksum";
/**
 * A constant string representing an error message for invalid base64url input.
 * This value is used to indicate that the provided input does not conform to the
 * expected base64url format or specification.
 *
 * @protected
 */
export declare const INVALID_BASE64URL_INPUT = "Invalid base64url input";
/**
 * Converts a given Uint8Array or ArrayBuffer to a Base64 URL-safe encoded string.
 *
 * @param {Uint8Array | ArrayBuffer} arr - The input data to be converted to a Base64 URL-safe string.
 * @return {string} A Base64 URL-safe encoded string representation of the input data.
 */
export declare function toBase64URL(arr: Uint8Array | ArrayBuffer): string;
/**
 * Converts a Base64 URL-encoded string into a Uint8Array.
 *
 * @param {string} base64url - The Base64 URL-encoded string to be converted.
 * This string must be a valid Base64 URL-safe format.
 * @return {Uint8Array} A Uint8Array representing the decoded binary data from the input Base64 URL string.
 * @throws {Error} If the provided input is not a string or is an invalid Base64 URL format.
 */
export declare function fromBase64Url(base64url: string): Uint8Array;
/**
 * Encodes a given address into a string representation, including its checksum.
 *
 * @param {Uint8Array} address The public key to be encoded into an address.
 * @return {string} The encoded address as a string representation.
 *
 * @deprecated - use algo-models or algokit-utils
 */
export declare function encodeAddress(address: Uint8Array): string;
/**
 * decodeAddress takes an Algorand address in string form and decodes it into a Uint8Array.
 * @param address - an Algorand address with checksum.
 * @returns the decoded form of the address's public key and checksum
 *
 * @deprecated use algo-models or algokit-utils
 */
export declare function decodeAddress(address: string): Uint8Array;
