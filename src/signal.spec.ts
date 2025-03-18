import { vi, test, expect, describe, beforeEach, afterEach } from 'vitest';
import { SocketServerMock } from 'socket.io-mock-ts';
import { SignalClient, generateQRCode, generateDeepLink } from './signal';
import {
  REQUEST_IN_PROCESS_MESSAGE,
  REQUEST_IS_MISSING_MESSAGE,
  UNAUTHENTICATED_MESSAGE,
} from './errors';
import { createMocks } from '../test/test.config';

import getResponseResponseFixtures from '../__fixtures__/attestation.response.response.fixtures.json';

import createResponseBodyFixtures from '../__fixtures__/attestation.response.body.fixtures.json';
import createResponseResponseFixtures from '../__fixtures__/attestation.response.response.fixtures.json';

// @ts-expect-error, needed for testing
globalThis.RTCPeerConnection = vi.fn().mockImplementation(() => {
  return {
    createDataChannel: vi.fn(() => {
      return {
        send: vi.fn(),
      };
    }),
    createOffer: vi.fn().mockResolvedValue({
      type: 'offer',
      sdp: 'offer-sdp-fixture',
    }),
    createAnswer: vi.fn().mockResolvedValue({
      type: 'answer',
      sdp: 'answer-sdp-fixture',
    }),

    // @ts-expect-error, needed for testing
    setLocalDescription: vi.fn().mockResolvedValue(),
    // @ts-expect-error, needed for testing
    setRemoteDescription: vi.fn().mockResolvedValue(),
    // @ts-expect-error, needed for testing
    addIceCandidate: vi.fn().mockResolvedValue(),
    ondatachannel: vi.fn(),
    onicecandidate: vi.fn(),
    onnegotiationneeded: vi.fn(),
    oniceconnectionstatechange: vi.fn(),
    onicegatheringstatechange: vi.fn(),
    onsignalingstatechange: vi.fn(),
    onconnectionstatechange: vi.fn(),
    onicecandidateerror: vi.fn(),
    ontrack: vi.fn(),
  };
});

globalThis.RTCIceCandidate = vi.fn().mockImplementation((candidate) => {
  return candidate;
});
let socket: SocketServerMock;
vi.mock('socket.io-client', () => {
  return {
    io: () => socket.clientMock,
  };
});

beforeEach(() => {
  socket = new SocketServerMock();
});

describe('SignalClient', function () {
  const url = 'https://localhost:0';
  let client: SignalClient;
  beforeEach(async () => {
    createMocks();
    client = new SignalClient(url);
    client.emit = vi.fn();
  });
  afterEach(() => {
    client.socket?.disconnect();
    socket.disconnect();
  });
  // Client Constructor
  test('constructor', function () {
    expect(client.url).toEqual(url);
    socket.emit('connect');
    socket.emit('disconnect');
    expect(client.emit).toHaveBeenNthCalledWith(1, 'connect', undefined);
    expect(client.emit).toHaveBeenNthCalledWith(2, 'disconnect', undefined);
  });
  // Request ID
  test('generateRequestId', function () {
    const id = SignalClient.generateRequestId();
    expect(id).toBeDefined();
    expect(id.length).toBe(36);
  });

  // TODO: Decide what to do with QR Code generation, possibly fork and maintain the library since Pera also uses it
  test('qrCode', async function () {
    await expect(() => client.qrCode()).rejects.toThrow(
      new Error(REQUEST_IS_MISSING_MESSAGE),
    );

    client.requestId = SignalClient.generateRequestId();
    if (typeof window !== 'undefined') {
      const qrCode = await client.qrCode();
      expect(qrCode).toBeDefined();
    } else {
      await expect(() => client.qrCode()).rejects.toThrow();
    }
  });

  test('deepLink', function () {
    expect(() => client.deepLink()).toThrow(
      new Error(REQUEST_IS_MISSING_MESSAGE),
    );
    const requestId = SignalClient.generateRequestId();
    const fixture = `${client.url.replace('https://', 'liquid://')}/?requestId=${requestId}`;
    const deepLink = client.deepLink(requestId);
    expect(deepLink).toEqual(fixture);

    client.requestId = requestId;
    expect(client.deepLink()).toEqual(fixture);
  });

  // FIDO Attestations
  test('attestation', async function () {
    const response = await client.attestation(async () => {
      return createResponseBodyFixtures[0].clientExtensionResults.liquid;
    });
    expect(response).toEqual(createResponseResponseFixtures[0]);
  });

  // FIDO Assertions
  test('assertion', async () => {
    const credentialId =
      'AYMPi2Rbhcnu2gSHOO1TNvzDJ38iU00rrlCqyH874XCIEoIotRc7eVRFpx0TvsQurg7BAnXy5KnWdKC8LeWs0k0';
    const response = await client.assertion(credentialId);
    expect(response).toEqual({
      ...getResponseResponseFixtures[0],
      credentials: [
        { ...getResponseResponseFixtures[0].credentials[0], prevCounter: 1 },
      ],
    });
  });

  test('peer(offer) unbuffered', async function () {
    const requestId = SignalClient.generateRequestId();
    const linkMessageFixture = {
      requestId,
      wallet: '65X3KSKFCNX3VUPQDVO3RQUHDZN7BONGBEC6PJWAVKX73DIC356M7M32JM',
    };
    const sdpFixture = {
      type: 'offer',
      sdp: 'offer-sdp-fixture',
    };
    socket.on('link', (payload, ack) => {
      ack({
        data: linkMessageFixture,
      });
    });
    // wait for an answer
    const result = client.peer(requestId, 'offer');
    expect(client.emit).toHaveBeenNthCalledWith(1, 'link', { requestId });
    expect(client.emit).toHaveBeenNthCalledWith(
      2,
      'link-message',
      linkMessageFixture,
    );
    // Wait for the next tick
    if (typeof process !== 'undefined') {
      await new Promise<void>((resolve) => {
        process.nextTick(() => {
          resolve();
        });
      });
    } else {
      await Promise.resolve();
    }
    // Handle local candidates
    client?.peerClient?.onicecandidate({
      candidate: {
        toJSON() {
          return { candidate: 'candidate-fixture' };
        },
      },
    });
    // Handle Else condition
    // @ts-expect-error, for testing purposes
    client.peerClient.onicecandidate({});

    // Emit an offer from a peer
    socket.emit('offer-description', sdpFixture.sdp);

    (client.peerClient as any).remoteDescription = 'remote-description-fixture';

    // Emit an unbuffered candidate from the peer
    socket.emit('offer-candidate', { candidate: 'candidate-fixture' });

    // Resolve the DataChannel from the Peer
    client.peerClient.ondatachannel({
      channel: {
        send: vi.fn(),
      },
    });
    // TODO: investigate browser issue
    if (typeof window === 'undefined') {
      await expect(result).resolves.toHaveProperty('send');
    }
  });
  test('peer(offer)', async function () {
    const requestId = SignalClient.generateRequestId();
    const linkMessageFixture = {
      requestId,
      wallet: '65X3KSKFCNX3VUPQDVO3RQUHDZN7BONGBEC6PJWAVKX73DIC356M7M32JM',
    };
    const sdpFixture = {
      type: 'offer',
      sdp: 'offer-sdp-fixture',
    };
    socket.on('link', (payload, ack) => {
      ack({
        data: linkMessageFixture,
      });
    });
    // wait for an answer
    const result = client.peer(requestId, 'offer');
    expect(client.emit).toHaveBeenNthCalledWith(1, 'link', { requestId });
    expect(client.emit).toHaveBeenNthCalledWith(
      2,
      'link-message',
      linkMessageFixture,
    );
    // Wait for the next tick
    if (typeof process !== 'undefined') {
      await new Promise<void>((resolve) => {
        process.nextTick(() => {
          resolve();
        });
      });
    } else {
      await Promise.resolve();
    }
    // Handle local candidates
    client.peerClient.onicecandidate({
      candidate: {
        toJSON() {
          return { candidate: 'candidate-fixture' };
        },
      },
    });
    // Handle Else condition
    client.peerClient.onicecandidate({});

    // Emit a buffered candidate from the peer
    socket.emit('offer-candidate', { candidate: 'candidate-fixture' });

    // Emit an offer from a peer
    socket.emit('offer-description', sdpFixture.sdp);
    (client.peerClient as any).remoteDescription = 'remote-description-fixture';

    // Emit an unbuffered candidate from the peer
    socket.emit('offer-candidate', { candidate: 'candidate-fixture' });

    // Resolve the DataChannel from the Peer
    client.peerClient.ondatachannel({
      channel: {
        send: vi.fn(),
      },
    });

    if (typeof window === 'undefined') {
      await expect(result).resolves.toHaveProperty('send');
    }
  });
  test('peer(answer) unbuffered', async function () {
    // Only allow one peer session at a time
    client.requestId = '019097ff-bb8d-7a31-83bb-aa934d351662';
    await expect(() =>
      client.peer('019097ff-bb8d-7a31-83bb-aa934d351662', 'answer'),
    ).rejects.toThrow(new Error(REQUEST_IN_PROCESS_MESSAGE));
    delete client.requestId;

    const sdpFixture = {
      type: 'answer',
      sdp: 'answer-sdp-fixture',
    };
    const requestId = SignalClient.generateRequestId();
    client.authenticated = true;
    // wait for an answer
    const result = client.peer(requestId, 'answer');

    // Handle local candidates
    client.peerClient.onicecandidate({
      candidate: {
        toJSON() {
          return { candidate: 'candidate-fixture' };
        },
      },
    });
    // Handle Else condition
    client.peerClient.onicecandidate({});

    // Check that the local candidate was emitted
    expect(client.emit).toHaveBeenNthCalledWith(1, 'offer-candidate', {
      candidate: 'candidate-fixture',
    });

    // Wait for the next tick
    if (typeof process !== 'undefined') {
      await new Promise<void>((resolve) => {
        process.nextTick(() => {
          resolve();
        });
      });
    } else {
      await Promise.resolve();
    }

    // Emit an answer from a peer
    socket.emit('answer-description', sdpFixture.sdp);
    (client.peerClient as any).remoteDescription = 'remote-description-fixture';

    // Emit an unbuffered candidate from the peer
    socket.emit('answer-candidate', { candidate: 'candidate-fixture' });

    if (typeof window === 'undefined') {
      await expect(result).resolves.toHaveProperty('send');
    }
  });
  test('peer(answer)', async function () {
    // Only allow one peer session at a time
    client.requestId = '019097ff-bb8d-7a31-83bb-aa934d351662';
    await expect(() =>
      client.peer('019097ff-bb8d-7a31-83bb-aa934d351662', 'answer'),
    ).rejects.toThrow(new Error(REQUEST_IN_PROCESS_MESSAGE));
    delete client.requestId;

    const sdpFixture = {
      type: 'answer',
      sdp: 'answer-sdp-fixture',
    };
    const requestId = SignalClient.generateRequestId();
    client.authenticated = true;
    // wait for an answer
    const result = client.peer(requestId, 'answer');

    // Handle local candidates
    client.peerClient.onicecandidate({
      candidate: {
        toJSON() {
          return { candidate: 'candidate-fixture' };
        },
      },
    });
    // Handle Else condition
    client.peerClient.onicecandidate({});

    // Check that the local candidate was emitted
    expect(client.emit).toHaveBeenNthCalledWith(1, 'offer-candidate', {
      candidate: 'candidate-fixture',
    });

    // Emit a buffered candidate from the peer
    socket.emit('answer-candidate', { candidate: 'candidate-fixture' });

    // Wait for the next tick
    if (typeof process !== 'undefined') {
      await new Promise<void>((resolve) => {
        process.nextTick(() => {
          resolve();
        });
      });
    } else {
      await Promise.resolve();
    }
    // Emit an answer from a peer
    socket.emit('answer-description', sdpFixture.sdp);
    (client.peerClient as any).remoteDescription = 'remote-description-fixture';

    // Emit an unbuffered candidate from the peer
    socket.emit('answer-candidate', { candidate: 'candidate-fixture' });

    if (typeof window === 'undefined') {
      await expect(result).resolves.toHaveProperty('send');
    }
  });

  // Link Messages
  test('link', async function () {
    const requestId = SignalClient.generateRequestId();
    const linkMessageFixture = {
      requestId,
      wallet: '65X3KSKFCNX3VUPQDVO3RQUHDZN7BONGBEC6PJWAVKX73DIC356M7M32JM',
    };
    socket.on('link', (payload, ack) => {
      ack({
        data: linkMessageFixture,
      });
    });
    const result = client.link(requestId);
    expect(client.emit).toHaveBeenNthCalledWith(1, 'link', { requestId });
    await expect(result).resolves.toEqual(linkMessageFixture);
    expect(client.emit).toHaveBeenNthCalledWith(
      2,
      'link-message',
      linkMessageFixture,
    );

    client.requestId = requestId;
    await expect(() => client.link(requestId)).rejects.toThrow(
      new Error(REQUEST_IN_PROCESS_MESSAGE),
    );
  });

  test('signal', async function () {
    await expect(() => client.signal()).rejects.toThrow(
      new Error(UNAUTHENTICATED_MESSAGE),
    );
    client.authenticated = true;
    const sdpFixture = {
      type: 'offer',
      sdp: 'offer-sdp-fixture',
    };
    const result = client.signal('offer');
    expect(client.emit).toHaveBeenNthCalledWith(1, 'signal', { type: 'offer' });
    socket.emit('offer-description', sdpFixture.sdp);
    await expect(result).resolves.toEqual(sdpFixture);
    expect(client.emit).toHaveBeenNthCalledWith(
      2,
      'offer-description',
      sdpFixture,
    );
  });

  test('close', function () {
    client.close(true);
    expect(client.socket.connected).toBe(false);
    client.close();
    expect(client.requestId).toBeUndefined();
  });
});

test('generateQRCode', async () => {
  const qrFixture = {
    url: 'https://liquid-auth.onrender.com',
    requestId: '34337d4a-0a42-4a51-a418-13a5b7c8e86d',
  };
  if (typeof window !== 'undefined') {
    await expect(async () =>
      generateQRCode({ url: qrFixture.url }),
    ).rejects.toThrow(new Error(REQUEST_IS_MISSING_MESSAGE));
    const result = await generateQRCode(qrFixture);
    expect(result).toBeDefined();
  } else {
    await expect(() => generateQRCode(qrFixture)).rejects.toThrow();
  }
});

test('generateDeepLink', async () => {
  const url = 'https://liquid-auth.onrender.com';
  const requestId = SignalClient.generateRequestId();
  const fixture = `${url.replace('https://', 'liquid://')}/?requestId=${requestId}`;
  expect(generateDeepLink(url, requestId)).toEqual(fixture);
  expect(() =>
    // @ts-expect-error, needed for testing
    generateDeepLink(url),
  ).toThrow(new Error(REQUEST_IS_MISSING_MESSAGE));
});
