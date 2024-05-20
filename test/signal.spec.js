import { jest, test, expect, describe, beforeEach, afterEach } from "@jest/globals";
import SocketMock from "socket.io-mock";

// Mock QR Code Raw Data
let getRawData = () => {
  return new Promise((resolve, reject) => {
    resolve(new Blob());
  });
};
// Mock QR Code
jest.unstable_mockModule("qr-code-styling", () => {
  return {
    default: class QRCodeStyling {
      constructor(options) {
        this.options = options;
      }

      getRawData() {
        return getRawData();
      }
    }
  };
});


// Mock Attestation
jest.unstable_mockModule("../lib/attestation.js", () => {
  return {
    attestation: jest.fn(async () => {
      if (globalThis.throwsAttestationError) throw new Error("Test Error");
    }),
    DEFAULT_ATTESTATION_OPTIONS: {
      attestationType: "none",
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        requireResidentKey: false
      },
      extensions: {
        liquid: true
      }
    }
  };
});

globalThis.RTCPeerConnection = jest.fn().mockImplementation(() => {
  return {
    createDataChannel: jest.fn(() => {
      return {
        send: jest.fn()
      };
    }),
    createOffer: jest.fn().mockResolvedValue({
      type: "offer",
      sdp: "offer-sdp-fixture"
    }),
    createAnswer: jest.fn().mockResolvedValue({
      type: "answer",
      sdp: "answer-sdp-fixture"
    }),
    setLocalDescription: jest.fn().mockResolvedValue(),
    setRemoteDescription: jest.fn().mockResolvedValue(),
    addIceCandidate: jest.fn().mockResolvedValue(),
    ondatachannel: jest.fn(),
    onicecandidate: jest.fn(),
    onnegotiationneeded: jest.fn(),
    oniceconnectionstatechange: jest.fn(),
    onicegatheringstatechange: jest.fn(),
    onsignalingstatechange: jest.fn(),
    onconnectionstatechange: jest.fn(),
    onicecandidateerror: jest.fn(),
    ontrack: jest.fn()
  };
});
globalThis.RTCIceCandidate = jest.fn().mockImplementation((candidate) => {
  return candidate;
})
describe("SignalClient", function() {
  const url = "https://liquid-auth.onrender.com";
  let SignalClient;
  let mod;
  let client;
  let socket;
  beforeEach(async () => {
    socket = new SocketMock();
    jest.unstable_mockModule("socket.io-client", () => {
      return {
        io: () => socket.socketClient
      };
    });
    const { SignalClient: Interface, ...rest } = await import("../lib/signal.js");
    SignalClient = Interface;
    mod = rest;
    client = new SignalClient(url);
    client.emit = jest.fn();
  });
  afterEach(() => {
    client.socket?.disconnect();
    socket.disconnect()
  });
  // Client Constructor
  test("constructor", function() {
    expect(client.url).toEqual(url);
    socket.emit("connect");
    socket.emit("disconnect");
    expect(client.emit).toHaveBeenNthCalledWith(1, "connect", undefined);
    expect(client.emit).toHaveBeenNthCalledWith(2, "disconnect", undefined);
  });
  // Request ID
  test("generateRequestId", function() {
    const id = SignalClient.generateRequestId();
    expect(id).toBeGreaterThan(0);
  });

  // TODO: Decide what to do with QR Code generation, possibly fork and maintain the library since Pera also uses it
  test("qrCode", async function() {
    await expect(() => client.qrCode()).rejects.toThrow(new Error(mod.REQUEST_IS_MISSING_MESSAGE));
    client.requestId = SignalClient.generateRequestId();
    const qrCode = await client.qrCode();
    expect(qrCode).toBeDefined();
  });

  // FIDO Attestations
  test("attestation", async function() {
    const onChallenge = jest.fn();
    await expect(client.attestation(onChallenge)).resolves.toBeUndefined();
    expect(client.authenticated).toBe(true);
    globalThis.throwsAttestationError = true;
    await expect(client.attestation(onChallenge)).rejects.toThrow(new Error("Test Error"));
    expect(client.authenticated).toBe(false);
  });

  // FIDO Assertions
  test("assertion", function() {
    expect(client.assertion()).toBeUndefined();
  });

  test("peer(offer) unbuffered", async function(){
    let requestId = SignalClient.generateRequestId();
    const linkMessageFixture = {
      requestId,
      wallet: "65X3KSKFCNX3VUPQDVO3RQUHDZN7BONGBEC6PJWAVKX73DIC356M7M32JM"
    };
    const sdpFixture = {
      type: "offer",
      sdp: "offer-sdp-fixture"
    };
    socket.on('link', (payload, ack) => {
      ack({
        data: linkMessageFixture
      });
    })
    // wait for an answer
    const result = client.peer(requestId, "offer");
    expect(client.emit).toHaveBeenNthCalledWith(1, "link", { requestId });
    expect(client.emit).toHaveBeenNthCalledWith(2, "link-message", linkMessageFixture);
    // Wait for the next tick
    await new Promise((resolve) => {
      process.nextTick(() => {
        resolve();
      });
    });
    // Handle local candidates
    client.peerClient.onicecandidate({
      candidate: {
        toJSON() {
          return { candidate: "candidate-fixture" };
        }
      }
    });
    // Handle Else condition
    client.peerClient.onicecandidate({})

    // Emit an offer from a peer
    socket.emit("offer-description", sdpFixture.sdp);
    client.peerClient.remoteDescription = "remote-description-fixture";

    // Emit an unbuffered candidate from the peer
    socket.emit('offer-candidate', { candidate: "candidate-fixture" });

    // Resolve the DataChannel from the Peer
    client.peerClient.ondatachannel({
      channel: {
        send: jest.fn()
      }
    });

    await expect(result).resolves.toHaveProperty("send");
  })
  test("peer(offer)", async function(){
    let requestId = SignalClient.generateRequestId();
    const linkMessageFixture = {
      requestId,
      wallet: "65X3KSKFCNX3VUPQDVO3RQUHDZN7BONGBEC6PJWAVKX73DIC356M7M32JM"
    };
    const sdpFixture = {
      type: "offer",
      sdp: "offer-sdp-fixture"
    };
    socket.on('link', (payload, ack) => {
      ack({
        data: linkMessageFixture
      });
    })
    // wait for an answer
    const result = client.peer(requestId, "offer");
    expect(client.emit).toHaveBeenNthCalledWith(1, "link", { requestId });
    expect(client.emit).toHaveBeenNthCalledWith(2, "link-message", linkMessageFixture);
    // Wait for the next tick
    await new Promise((resolve) => {
      process.nextTick(() => {
        resolve();
      });
    });
    // Handle local candidates
    client.peerClient.onicecandidate({
      candidate: {
        toJSON() {
          return { candidate: "candidate-fixture" };
        }
      }
    });
    // Handle Else condition
    client.peerClient.onicecandidate({})

    // Emit a buffered candidate from the peer
    socket.emit('offer-candidate', { candidate: "candidate-fixture" });

    // Emit an offer from a peer
    socket.emit("offer-description", sdpFixture.sdp);
    client.peerClient.remoteDescription = "remote-description-fixture";

    // Emit an unbuffered candidate from the peer
    socket.emit('offer-candidate', { candidate: "candidate-fixture" });

    // Resolve the DataChannel from the Peer
    client.peerClient.ondatachannel({
      channel: {
        send: jest.fn()
      }
    });

    await expect(result).resolves.toHaveProperty("send");
  })
  test("peer(answer) unbuffered", async function(){
    // Only allow one peer session at a time
    client.requestId = 1234
    await expect(()=>client.peer(1234, "answer")).rejects.toThrow(new Error(mod.REQUEST_IN_PROCESS_MESSAGE));
    delete client.requestId;

    const sdpFixture = {
      type: "answer",
      sdp: "answer-sdp-fixture"
    };
    const requestId = SignalClient.generateRequestId();
    client.authenticated = true;
    // wait for an answer
    const result = client.peer(requestId, "answer");

    // Handle local candidates
    client.peerClient.onicecandidate({
      candidate: {
        toJSON() {
          return { candidate: "candidate-fixture" };
        }
      }
    });
    // Handle Else condition
    client.peerClient.onicecandidate({})

    // Check that the local candidate was emitted
    expect(client.emit).toHaveBeenNthCalledWith(1, "offer-candidate", { "candidate": "candidate-fixture" });

    // Wait for the next tick
    await new Promise((resolve) => {
      process.nextTick(() => {
        resolve();
      });
    });

    // Emit an answer from a peer
    socket.emit("answer-description", sdpFixture.sdp);
    client.peerClient.remoteDescription = "remote-description-fixture";

    // Emit an unbuffered candidate from the peer
    socket.emit('answer-candidate', { candidate: "candidate-fixture" });

    await expect(result).resolves.toHaveProperty("send");
  })
  test("peer(answer)", async function() {
    // Only allow one peer session at a time
    client.requestId = 1234
    await expect(()=>client.peer(1234, "answer")).rejects.toThrow(new Error(mod.REQUEST_IN_PROCESS_MESSAGE));
    delete client.requestId;

    const sdpFixture = {
      type: "answer",
      sdp: "answer-sdp-fixture"
    };
    const requestId = SignalClient.generateRequestId();
    client.authenticated = true;
    // wait for an answer
    const result = client.peer(requestId, "answer");

    // Handle local candidates
    client.peerClient.onicecandidate({
        candidate: {
          toJSON() {
            return { candidate: "candidate-fixture" };
          }
        }
    });
    // Handle Else condition
    client.peerClient.onicecandidate({})

    // Check that the local candidate was emitted
    expect(client.emit).toHaveBeenNthCalledWith(1, "offer-candidate", { "candidate": "candidate-fixture" });

    // Emit a buffered candidate from the peer
    socket.emit('answer-candidate', { candidate: "candidate-fixture" });

    // Wait for the next tick
    await new Promise((resolve) => {
      process.nextTick(() => {
        resolve();
      });
    });

    // Emit an answer from a peer
    socket.emit("answer-description", sdpFixture.sdp);
    client.peerClient.remoteDescription = "remote-description-fixture";

    // Emit an unbuffered candidate from the peer
    socket.emit('answer-candidate', { candidate: "candidate-fixture" });



    await expect(result).resolves.toHaveProperty("send");
  });

  // Link Messages
  test("link", async function() {
    const requestId = SignalClient.generateRequestId();
    const linkMessageFixture = {
      requestId,
      wallet: "65X3KSKFCNX3VUPQDVO3RQUHDZN7BONGBEC6PJWAVKX73DIC356M7M32JM"
    };
    socket.on("link", (payload, ack) => {
      ack({
        data: linkMessageFixture
      });
    });
    const result = client.link(requestId);
    expect(client.emit).toHaveBeenNthCalledWith(1, "link", { requestId });
    await expect(result).resolves.toEqual(linkMessageFixture);
    expect(client.emit).toHaveBeenNthCalledWith(2, "link-message", linkMessageFixture);

    client.requestId = requestId;
    await expect(() => client.link(requestId)).rejects.toThrow(new Error(mod.REQUEST_IN_PROCESS_MESSAGE));
  });

  test("signal", async function() {
    expect(() => client.signal()).rejects.toThrow(new Error(mod.UNAUTHENTICATED_MESSAGE));
    client.authenticated = true;
    const sdpFixture = {
      type: "offer",
      sdp: "offer-sdp-fixture"
    };
    const result = client.signal("offer");
    expect(client.emit).toHaveBeenNthCalledWith(1, "signal", { type: "offer" });
    socket.emit("offer-description", sdpFixture.sdp);
    await expect(result).resolves.toEqual(sdpFixture);
    expect(client.emit).toHaveBeenNthCalledWith(2, "offer-description", sdpFixture);
  });

  test("close", function() {
    client.close(true);
    expect(client.socket.connected).toBe(false);
    client.close();
    expect(client.requestId).toBeUndefined();
  });
});

test("generateQRCode", async () => {
  const { generateQRCode, SignalClient, ...mod } = await import("../lib/signal.js");
  const qrFixture = { url: "https://liquid-auth.onrender.com", requestId: SignalClient.generateRequestId() };
  expect(generateQRCode(qrFixture)).toBeDefined();
  await expect(() => generateQRCode({ url: qrFixture.url })).rejects.toThrow(new Error(mod.REQUEST_IS_MISSING_MESSAGE));
  getRawData = () => {
    return new Promise((resolve) => {
      resolve(null);
    });
  };
  await expect(() => generateQRCode(qrFixture)).rejects.toThrow(new TypeError("Could not get qrcode blob"));
});
