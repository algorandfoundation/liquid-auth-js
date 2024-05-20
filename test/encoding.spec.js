import {test, expect} from '@jest/globals';

import {toBase64URL, fromBase64Url, encodeAddress, decodeAddress, INVALID_BASE64URL_INPUT, MALFORMED_ADDRESS_ERROR_MSG, ALGORAND_ADDRESS_BAD_CHECKSUM_ERROR_MSG} from '../lib/encoding.js';
import base64UrlFixtures from './__fixtures__/encoding.base64url.fixtures.json';
import walletKeysFixtures from './__fixtures__/wallet.keys.fixtures.json';


// Invalid Inputs
test(`fromBase64URL(*) throws ${INVALID_BASE64URL_INPUT}`, function(){
    expect(()=>fromBase64Url(12345)).toThrow(new Error(INVALID_BASE64URL_INPUT));
})
base64UrlFixtures.forEach((fixture, i)=>{
    const encoder = new TextEncoder();

    test(`toBase64URL(${fixture.origin})`, () => {
        expect(toBase64URL(i % 2 ? encoder.encode(fixture.origin) : fixture.fromBase64Url)).toEqual(fixture.toBase64Url);
    })
    test(`fromBase64URL(${fixture.origin})`, () => {
        expect(fromBase64Url(fixture.toBase64Url)).toEqual(new Uint8Array(fixture.fromBase64Url));
    });
})




// Test Basic Inputs
test(`decodeAddress(*) throws ${MALFORMED_ADDRESS_ERROR_MSG}`, function(){
    expect(()=>decodeAddress(12345)).toThrow( new Error(MALFORMED_ADDRESS_ERROR_MSG));
})
// Algorand Address Tests
walletKeysFixtures.forEach(function (fixture){
    test(`decodeAddress(${fixture.encoded})`, function(){
        const decoded = decodeAddress(fixture.encoded);
        expect(decoded).toEqual(new Uint8Array(fixture.publicKey));
    })
    test(`encodeAddress(${fixture.encoded})`, function() {
        const address = encodeAddress(new Uint8Array(fixture.publicKey));
        expect(address).toEqual(fixture.encoded);
    })

    test(`decodeAddress(${fixture.encoded.slice(0, -4) + "===="}) throws ${ALGORAND_ADDRESS_BAD_CHECKSUM_ERROR_MSG}`, function(){
        expect(()=>decodeAddress(fixture.encoded.slice(0, -4) + "====")).toThrow(new Error(ALGORAND_ADDRESS_BAD_CHECKSUM_ERROR_MSG))
    })

})
