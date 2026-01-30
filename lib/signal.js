import { io } from "socket.io-client";
import QRCodeStyling from "qr-code-styling";
import { EventEmitter } from "eventemitter3";
import { v7 } from "uuid";
import { attestation } from "./attestation.js";
import { assertion } from "./assertion.js";
import { DEFAULT_QR_CODE_OPTIONS } from "./constants.js";
import { REQUEST_IS_MISSING_MESSAGE, ORIGIN_IS_MISSING_MESSAGE, REQUEST_IN_PROCESS_MESSAGE, UNAUTHENTICATED_MESSAGE } from "./errors.js";
import { DEFAULT_ATTESTATION_OPTIONS } from "./attestation.fetch.js";
async function generateQRCode({ requestId, url }, qrCodeOptions = DEFAULT_QR_CODE_OPTIONS) {
  if (typeof requestId === "undefined")
    throw new Error(REQUEST_IS_MISSING_MESSAGE);
  qrCodeOptions.data = generateDeepLink(url, requestId);
  const qrCode = new QRCodeStyling(qrCodeOptions);
  return await qrCode.getRawData("png").then((blob) => {
    if (!blob) throw new TypeError("Could not get qrcode blob");
    return URL.createObjectURL(blob);
  });
}
function generateDeepLink(origin, requestId) {
  if (typeof origin !== "string") {
    throw new Error(ORIGIN_IS_MISSING_MESSAGE);
  }
  if (typeof requestId !== "string") {
    throw new Error(REQUEST_IS_MISSING_MESSAGE);
  }
  return `liquid://${origin.replace("https://", "")}/?requestId=${requestId}`;
}
class SignalClient extends EventEmitter {
  /**
   *
   * @param url
   * @param options
   */
  constructor(url, options = { autoConnect: true }) {
    super();
    this.type = null;
    this.authenticated = false;
    this.qrCodeOptions = DEFAULT_QR_CODE_OPTIONS;
    this.url = url;
    this.socket = io(url, options);
    this.socket.on("connect", () => {
      this.emit("connect", this.socket.id);
    });
    this.socket.on("disconnect", () => {
      this.emit("disconnect", this.socket.id);
    });
  }
  static generateRequestId() {
    return v7();
  }
  /**
   * Handles the process of attestation by invoking the provided challenge handler and the specified options.
   *
   * @param {function(Uint8Array): any} onChallenge - A callback function to handle the challenge. Receives a Uint8Array representing the challenge.
   * @param {object} [options=DEFAULT_ATTESTATION_OPTIONS] - Configuration options for the attestation process.
   * @param debug
   * @return {Promise<void>} A promise that resolves when attestation is successfully completed or rejects with an error if it fails.
   */
  async attestation(onChallenge, options = DEFAULT_ATTESTATION_OPTIONS, debug = false) {
    try {
      const response = await attestation({
        origin: this.url,
        onChallenge,
        options,
        debug
      });
      this.authenticated = true;
      return response;
    } catch (e) {
      this.authenticated = false;
      throw e;
    }
  }
  async assertion(credId, debug = false) {
    try {
      const response = await assertion({
        origin: this.url,
        credId,
        debug
      });
      this.authenticated = true;
      return response;
    } catch (e) {
      this.authenticated = false;
      throw e;
    }
  }
  /**
   * Create QR Code
   */
  async qrCode() {
    if (typeof this.requestId === "undefined")
      throw new Error(REQUEST_IS_MISSING_MESSAGE);
    return generateQRCode(
      { requestId: this.requestId, url: this.url },
      this.qrCodeOptions
    );
  }
  /**
   * Create a Deep Link URI
   * @param requestId
   */
  deepLink(requestId) {
    if (typeof requestId !== "string" && typeof this.requestId === "undefined") {
      throw new Error(REQUEST_IS_MISSING_MESSAGE);
    }
    return generateDeepLink(this.url, requestId || this.requestId || "");
  }
  /**
   * # Create a peer connection
   *
   * Send the nonce to the server and listen to a specified type.
   *
   * ## Offer
   *   - Will wait for an offer-description from the server
   *   - Will send an answer-description to the server
   *   - Will send candidates to the server
   *
   * ## Answer
   *  - Will send an offer-description to the server
   *  - Will wait for an answer-description from the server
   *  - Will send candidates to the server
   *
   * @param requestId
   * @param type
   * @param config
   */
  async peer(requestId, type, config = {
    iceServers: [
      {
        urls: [
          "stun:stun.l.google.com:19302",
          "stun:stun1.l.google.com:19302",
          "stun:stun2.l.google.com:19302"
        ]
      }
    ],
    iceCandidatePoolSize: 10
  }) {
    if (typeof this.requestId !== "undefined")
      throw new Error(REQUEST_IN_PROCESS_MESSAGE);
    return new Promise(async (resolve) => {
      if (typeof requestId === "undefined") {
        throw new Error(REQUEST_IS_MISSING_MESSAGE);
      }
      let candidatesBuffer = [];
      this.peerClient = new RTCPeerConnection(config);
      this.type = type === "offer" ? "answer" : "offer";
      type === "offer" && await this.link(requestId);
      this.peerClient.onicecandidate = (event) => {
        if (event.candidate) {
          this.emit(`${this.type}-candidate`, event.candidate.toJSON());
          this.socket.emit(`${this.type}-candidate`, event.candidate.toJSON());
        }
      };
      this.socket.on(
        `${type}-candidate`,
        async (candidate) => {
          var _a, _b;
          if (((_a = this.peerClient) == null ? void 0 : _a.remoteDescription) && ((_b = this.peerClient) == null ? void 0 : _b.remoteDescription)) {
            this.emit(`${type}-candidate`, candidate);
            await this.peerClient.addIceCandidate(
              new RTCIceCandidate(candidate)
            );
          } else {
            candidatesBuffer.push(candidate);
          }
        }
      );
      this.peerClient.ondatachannel = (event) => {
        this.emit("data-channel", event.channel);
        resolve(event.channel);
      };
      if (type === "offer") {
        const sdp = await this.signal(type);
        await this.peerClient.setRemoteDescription(sdp);
        const answer = await this.peerClient.createAnswer();
        await this.peerClient.setLocalDescription(answer);
        if (candidatesBuffer.length > 0) {
          await Promise.all(
            candidatesBuffer.map(async (candidate) => {
              var _a;
              this.emit(`${type}-candidate`, candidate);
              await ((_a = this.peerClient) == null ? void 0 : _a.addIceCandidate(
                new RTCIceCandidate(candidate)
              ));
            })
          );
          candidatesBuffer = [];
        }
        this.emit(`${this.type}-description`, answer.sdp);
        this.socket.emit(`${this.type}-description`, answer.sdp);
      } else {
        const dataChannel = this.peerClient.createDataChannel("liquid");
        const localSdp = await this.peerClient.createOffer();
        await this.peerClient.setLocalDescription(localSdp);
        this.socket.emit(`${this.type}-description`, localSdp.sdp);
        this.emit(`${this.type}-description`, localSdp.sdp);
        const sdp = await this.signal(type);
        await this.peerClient.setRemoteDescription(sdp);
        if (candidatesBuffer.length > 0) {
          await Promise.all(
            candidatesBuffer.map(async (candidate) => {
              var _a;
              this.emit(`${type}-candidate`, candidate);
              await ((_a = this.peerClient) == null ? void 0 : _a.addIceCandidate(
                new RTCIceCandidate(candidate)
              ));
            })
          );
          candidatesBuffer = [];
        }
        this.emit("data-channel", dataChannel);
        resolve(dataChannel);
      }
    });
  }
  /**
   * Await for a link message for a given requestId
   * @param requestId
   */
  async link(requestId) {
    if (typeof this.requestId !== "undefined")
      throw new Error(REQUEST_IN_PROCESS_MESSAGE);
    this.requestId = requestId;
    this.emit("link", { requestId });
    return new Promise((resolve) => {
      this.socket.emit(
        "link",
        { requestId },
        ({ data }) => {
          this.authenticated = true;
          delete this.requestId;
          this.emit("link-message", data);
          resolve(data);
        }
      );
    });
  }
  /**
   *
   * @param type
   */
  async signal(type) {
    if (!this.authenticated) throw new Error(UNAUTHENTICATED_MESSAGE);
    this.emit("signal", { type });
    return new Promise((resolve) => {
      this.socket.once(`${type}-description`, (sdp) => {
        const description = { type, sdp };
        this.emit(`${type}-description`, description);
        resolve(description);
      });
    });
  }
  close(disconnect = false) {
    this.socket.removeAllListeners();
    delete this.requestId;
    this.authenticated = false;
    if (disconnect) this.socket.disconnect();
    this.emit("close");
  }
}
export {
  SignalClient,
  generateDeepLink,
  generateQRCode
};
//# sourceMappingURL=signal.js.map
