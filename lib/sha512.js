/*
 * [js-sha512]{@link https://github.com/emn178/js-sha512}
 *
 * @version 0.9.0
 * @author Chen, Yi-Cyuan [emn178@gmail.com]
 * @copyright Chen, Yi-Cyuan 2014-2024
 * @license MIT
 */
const INPUT_ERROR = "input is invalid type";
const FINALIZE_ERROR = "finalize already called";
const ARRAY_BUFFER = typeof ArrayBuffer !== "undefined";
const HEX_CHARS = "0123456789abcdef".split("");
const EXTRA = [-2147483648, 8388608, 32768, 128];
const SHIFT = [24, 16, 8, 0];
const K = [
  1116352408,
  3609767458,
  1899447441,
  602891725,
  3049323471,
  3964484399,
  3921009573,
  2173295548,
  961987163,
  4081628472,
  1508970993,
  3053834265,
  2453635748,
  2937671579,
  2870763221,
  3664609560,
  3624381080,
  2734883394,
  310598401,
  1164996542,
  607225278,
  1323610764,
  1426881987,
  3590304994,
  1925078388,
  4068182383,
  2162078206,
  991336113,
  2614888103,
  633803317,
  3248222580,
  3479774868,
  3835390401,
  2666613458,
  4022224774,
  944711139,
  264347078,
  2341262773,
  604807628,
  2007800933,
  770255983,
  1495990901,
  1249150122,
  1856431235,
  1555081692,
  3175218132,
  1996064986,
  2198950837,
  2554220882,
  3999719339,
  2821834349,
  766784016,
  2952996808,
  2566594879,
  3210313671,
  3203337956,
  3336571891,
  1034457026,
  3584528711,
  2466948901,
  113926993,
  3758326383,
  338241895,
  168717936,
  666307205,
  1188179964,
  773529912,
  1546045734,
  1294757372,
  1522805485,
  1396182291,
  2643833823,
  1695183700,
  2343527390,
  1986661051,
  1014477480,
  2177026350,
  1206759142,
  2456956037,
  344077627,
  2730485921,
  1290863460,
  2820302411,
  3158454273,
  3259730800,
  3505952657,
  3345764771,
  106217008,
  3516065817,
  3606008344,
  3600352804,
  1432725776,
  4094571909,
  1467031594,
  275423344,
  851169720,
  430227734,
  3100823752,
  506948616,
  1363258195,
  659060556,
  3750685593,
  883997877,
  3785050280,
  958139571,
  3318307427,
  1322822218,
  3812723403,
  1537002063,
  2003034995,
  1747873779,
  3602036899,
  1955562222,
  1575990012,
  2024104815,
  1125592928,
  2227730452,
  2716904306,
  2361852424,
  442776044,
  2428436474,
  593698344,
  2756734187,
  3733110249,
  3204031479,
  2999351573,
  3329325298,
  3815920427,
  3391569614,
  3928383900,
  3515267271,
  566280711,
  3940187606,
  3454069534,
  4118630271,
  4000239992,
  116418474,
  1914138554,
  174292421,
  2731055270,
  289380356,
  3203993006,
  460393269,
  320620315,
  685471733,
  587496836,
  852142971,
  1086792851,
  1017036298,
  365543100,
  1126000580,
  2618297676,
  1288033470,
  3409855158,
  1501505948,
  4234509866,
  1607167915,
  987167468,
  1816402316,
  1246189591
];
const OUTPUT_TYPES = ["hex", "array", "digest", "arrayBuffer"];
const blocks = [];
const isArray = Array.isArray;
const isView = ArrayBuffer.isView;
const formatMessage = function(message) {
  const type = typeof message;
  if (type === "string") {
    return [message, true];
  }
  if (type !== "object" || message === null) {
    throw new Error(INPUT_ERROR);
  }
  if (ARRAY_BUFFER && message.constructor === ArrayBuffer) {
    return [new Uint8Array(message), false];
  }
  if (!isArray(message) && !isView(message)) {
    throw new Error(INPUT_ERROR);
  }
  return [message, false];
};
const createOutputMethod = function(outputType, bits) {
  return function(message) {
    return new Sha512(bits, true).update(message)[outputType]();
  };
};
const createMethod = function(bits) {
  const method = createOutputMethod("hex", bits);
  method.create = function() {
    return new Sha512(bits);
  };
  method.update = function(message) {
    return method.create().update(message);
  };
  for (let i = 0; i < OUTPUT_TYPES.length; ++i) {
    const type = OUTPUT_TYPES[i];
    method[type] = createOutputMethod(type, bits);
  }
  return method;
};
function Sha512(bits, sharedMemory) {
  if (sharedMemory) {
    blocks[0] = blocks[1] = blocks[2] = blocks[3] = blocks[4] = blocks[5] = blocks[6] = blocks[7] = blocks[8] = blocks[9] = blocks[10] = blocks[11] = blocks[12] = blocks[13] = blocks[14] = blocks[15] = blocks[16] = blocks[17] = blocks[18] = blocks[19] = blocks[20] = blocks[21] = blocks[22] = blocks[23] = blocks[24] = blocks[25] = blocks[26] = blocks[27] = blocks[28] = blocks[29] = blocks[30] = blocks[31] = blocks[32] = 0;
    this.blocks = blocks;
  } else {
    this.blocks = [
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0
    ];
  }
  if (bits == 384) {
    this.h0h = 3418070365;
    this.h0l = 3238371032;
    this.h1h = 1654270250;
    this.h1l = 914150663;
    this.h2h = 2438529370;
    this.h2l = 812702999;
    this.h3h = 355462360;
    this.h3l = 4144912697;
    this.h4h = 1731405415;
    this.h4l = 4290775857;
    this.h5h = 2394180231;
    this.h5l = 1750603025;
    this.h6h = 3675008525;
    this.h6l = 1694076839;
    this.h7h = 1203062813;
    this.h7l = 3204075428;
  } else if (bits == 256) {
    this.h0h = 573645204;
    this.h0l = 4230739756;
    this.h1h = 2673172387;
    this.h1l = 3360449730;
    this.h2h = 596883563;
    this.h2l = 1867755857;
    this.h3h = 2520282905;
    this.h3l = 1497426621;
    this.h4h = 2519219938;
    this.h4l = 2827943907;
    this.h5h = 3193839141;
    this.h5l = 1401305490;
    this.h6h = 721525244;
    this.h6l = 746961066;
    this.h7h = 246885852;
    this.h7l = 2177182882;
  } else if (bits == 224) {
    this.h0h = 2352822216;
    this.h0l = 424955298;
    this.h1h = 1944164710;
    this.h1l = 2312950998;
    this.h2h = 502970286;
    this.h2l = 855612546;
    this.h3h = 1738396948;
    this.h3l = 1479516111;
    this.h4h = 258812777;
    this.h4l = 2077511080;
    this.h5h = 2011393907;
    this.h5l = 79989058;
    this.h6h = 1067287976;
    this.h6l = 1780299464;
    this.h7h = 286451373;
    this.h7l = 2446758561;
  } else {
    this.h0h = 1779033703;
    this.h0l = 4089235720;
    this.h1h = 3144134277;
    this.h1l = 2227873595;
    this.h2h = 1013904242;
    this.h2l = 4271175723;
    this.h3h = 2773480762;
    this.h3l = 1595750129;
    this.h4h = 1359893119;
    this.h4l = 2917565137;
    this.h5h = 2600822924;
    this.h5l = 725511199;
    this.h6h = 528734635;
    this.h6l = 4215389547;
    this.h7h = 1541459225;
    this.h7l = 327033209;
  }
  this.bits = bits;
  this.block = this.start = this.bytes = this.hBytes = 0;
  this.finalized = this.hashed = false;
}
Sha512.prototype.update = function(message) {
  if (this.finalized) {
    throw new Error(FINALIZE_ERROR);
  }
  const result = formatMessage(message);
  message = result[0];
  const isString = result[1];
  let code;
  let index = 0;
  let i;
  const length = message.length;
  const blocks2 = this.blocks;
  while (index < length) {
    if (this.hashed) {
      this.hashed = false;
      blocks2[0] = this.block;
      this.block = blocks2[1] = blocks2[2] = blocks2[3] = blocks2[4] = blocks2[5] = blocks2[6] = blocks2[7] = blocks2[8] = blocks2[9] = blocks2[10] = blocks2[11] = blocks2[12] = blocks2[13] = blocks2[14] = blocks2[15] = blocks2[16] = blocks2[17] = blocks2[18] = blocks2[19] = blocks2[20] = blocks2[21] = blocks2[22] = blocks2[23] = blocks2[24] = blocks2[25] = blocks2[26] = blocks2[27] = blocks2[28] = blocks2[29] = blocks2[30] = blocks2[31] = blocks2[32] = 0;
    }
    if (isString) {
      for (i = this.start; index < length && i < 128; ++index) {
        code = message.charCodeAt(index);
        if (code < 128) {
          blocks2[i >>> 2] |= code << SHIFT[i++ & 3];
        } else if (code < 2048) {
          blocks2[i >>> 2] |= (192 | code >>> 6) << SHIFT[i++ & 3];
          blocks2[i >>> 2] |= (128 | code & 63) << SHIFT[i++ & 3];
        } else if (code < 55296 || code >= 57344) {
          blocks2[i >>> 2] |= (224 | code >>> 12) << SHIFT[i++ & 3];
          blocks2[i >>> 2] |= (128 | code >>> 6 & 63) << SHIFT[i++ & 3];
          blocks2[i >>> 2] |= (128 | code & 63) << SHIFT[i++ & 3];
        } else {
          code = 65536 + ((code & 1023) << 10 | message.charCodeAt(++index) & 1023);
          blocks2[i >>> 2] |= (240 | code >>> 18) << SHIFT[i++ & 3];
          blocks2[i >>> 2] |= (128 | code >>> 12 & 63) << SHIFT[i++ & 3];
          blocks2[i >>> 2] |= (128 | code >>> 6 & 63) << SHIFT[i++ & 3];
          blocks2[i >>> 2] |= (128 | code & 63) << SHIFT[i++ & 3];
        }
      }
    } else {
      for (i = this.start; index < length && i < 128; ++index) {
        blocks2[i >>> 2] |= message[index] << SHIFT[i++ & 3];
      }
    }
    this.lastByteIndex = i;
    this.bytes += i - this.start;
    if (i >= 128) {
      this.block = blocks2[32];
      this.start = i - 128;
      this.hash();
      this.hashed = true;
    } else {
      this.start = i;
    }
  }
  if (this.bytes > 4294967295) {
    this.hBytes += this.bytes / 4294967296 << 0;
    this.bytes = this.bytes % 4294967296;
  }
  return this;
};
Sha512.prototype.finalize = function() {
  if (this.finalized) {
    return;
  }
  this.finalized = true;
  const blocks2 = this.blocks;
  const i = this.lastByteIndex;
  blocks2[32] = this.block;
  blocks2[i >>> 2] |= EXTRA[i & 3];
  this.block = blocks2[32];
  if (i >= 112) {
    if (!this.hashed) {
      this.hash();
    }
    blocks2[0] = this.block;
    blocks2[1] = blocks2[2] = blocks2[3] = blocks2[4] = blocks2[5] = blocks2[6] = blocks2[7] = blocks2[8] = blocks2[9] = blocks2[10] = blocks2[11] = blocks2[12] = blocks2[13] = blocks2[14] = blocks2[15] = blocks2[16] = blocks2[17] = blocks2[18] = blocks2[19] = blocks2[20] = blocks2[21] = blocks2[22] = blocks2[23] = blocks2[24] = blocks2[25] = blocks2[26] = blocks2[27] = blocks2[28] = blocks2[29] = blocks2[30] = blocks2[31] = blocks2[32] = 0;
  }
  blocks2[30] = this.hBytes << 3 | this.bytes >>> 29;
  blocks2[31] = this.bytes << 3;
  this.hash();
};
Sha512.prototype.hash = function() {
  const h0h = this.h0h;
  const h0l = this.h0l;
  const h1h = this.h1h;
  const h1l = this.h1l;
  const h2h = this.h2h;
  const h2l = this.h2l;
  const h3h = this.h3h;
  const h3l = this.h3l;
  const h4h = this.h4h;
  const h4l = this.h4l;
  const h5h = this.h5h;
  const h5l = this.h5l;
  const h6h = this.h6h;
  const h6l = this.h6l;
  const h7h = this.h7h;
  const h7l = this.h7l;
  const blocks2 = this.blocks;
  let j;
  let s0h;
  let s0l;
  let s1h;
  let s1l;
  let c1;
  let c2;
  let c3;
  let c4;
  let abh;
  let abl;
  let dah;
  let dal;
  let cdh;
  let cdl;
  let bch;
  let bcl;
  let majh;
  let majl;
  let t1h;
  let t1l;
  let t2h;
  let t2l;
  let chh;
  let chl;
  for (j = 32; j < 160; j += 2) {
    t1h = blocks2[j - 30];
    t1l = blocks2[j - 29];
    s0h = (t1h >>> 1 | t1l << 31) ^ (t1h >>> 8 | t1l << 24) ^ t1h >>> 7;
    s0l = (t1l >>> 1 | t1h << 31) ^ (t1l >>> 8 | t1h << 24) ^ (t1l >>> 7 | t1h << 25);
    t1h = blocks2[j - 4];
    t1l = blocks2[j - 3];
    s1h = (t1h >>> 19 | t1l << 13) ^ (t1l >>> 29 | t1h << 3) ^ t1h >>> 6;
    s1l = (t1l >>> 19 | t1h << 13) ^ (t1h >>> 29 | t1l << 3) ^ (t1l >>> 6 | t1h << 26);
    t1h = blocks2[j - 32];
    t1l = blocks2[j - 31];
    t2h = blocks2[j - 14];
    t2l = blocks2[j - 13];
    c1 = (t2l & 65535) + (t1l & 65535) + (s0l & 65535) + (s1l & 65535);
    c2 = (t2l >>> 16) + (t1l >>> 16) + (s0l >>> 16) + (s1l >>> 16) + (c1 >>> 16);
    c3 = (t2h & 65535) + (t1h & 65535) + (s0h & 65535) + (s1h & 65535) + (c2 >>> 16);
    c4 = (t2h >>> 16) + (t1h >>> 16) + (s0h >>> 16) + (s1h >>> 16) + (c3 >>> 16);
    blocks2[j] = c4 << 16 | c3 & 65535;
    blocks2[j + 1] = c2 << 16 | c1 & 65535;
  }
  let ah = h0h;
  let al = h0l;
  let bh = h1h;
  let bl = h1l;
  let ch = h2h;
  let cl = h2l;
  let dh = h3h;
  let dl = h3l;
  let eh = h4h;
  let el = h4l;
  let fh = h5h;
  let fl = h5l;
  let gh = h6h;
  let gl = h6l;
  let hh = h7h;
  let hl = h7l;
  bch = bh & ch;
  bcl = bl & cl;
  for (j = 0; j < 160; j += 8) {
    s0h = (ah >>> 28 | al << 4) ^ (al >>> 2 | ah << 30) ^ (al >>> 7 | ah << 25);
    s0l = (al >>> 28 | ah << 4) ^ (ah >>> 2 | al << 30) ^ (ah >>> 7 | al << 25);
    s1h = (eh >>> 14 | el << 18) ^ (eh >>> 18 | el << 14) ^ (el >>> 9 | eh << 23);
    s1l = (el >>> 14 | eh << 18) ^ (el >>> 18 | eh << 14) ^ (eh >>> 9 | el << 23);
    abh = ah & bh;
    abl = al & bl;
    majh = abh ^ ah & ch ^ bch;
    majl = abl ^ al & cl ^ bcl;
    chh = eh & fh ^ ~eh & gh;
    chl = el & fl ^ ~el & gl;
    t1h = blocks2[j];
    t1l = blocks2[j + 1];
    t2h = K[j];
    t2l = K[j + 1];
    c1 = (t2l & 65535) + (t1l & 65535) + (chl & 65535) + (s1l & 65535) + (hl & 65535);
    c2 = (t2l >>> 16) + (t1l >>> 16) + (chl >>> 16) + (s1l >>> 16) + (hl >>> 16) + (c1 >>> 16);
    c3 = (t2h & 65535) + (t1h & 65535) + (chh & 65535) + (s1h & 65535) + (hh & 65535) + (c2 >>> 16);
    c4 = (t2h >>> 16) + (t1h >>> 16) + (chh >>> 16) + (s1h >>> 16) + (hh >>> 16) + (c3 >>> 16);
    t1h = c4 << 16 | c3 & 65535;
    t1l = c2 << 16 | c1 & 65535;
    c1 = (majl & 65535) + (s0l & 65535);
    c2 = (majl >>> 16) + (s0l >>> 16) + (c1 >>> 16);
    c3 = (majh & 65535) + (s0h & 65535) + (c2 >>> 16);
    c4 = (majh >>> 16) + (s0h >>> 16) + (c3 >>> 16);
    t2h = c4 << 16 | c3 & 65535;
    t2l = c2 << 16 | c1 & 65535;
    c1 = (dl & 65535) + (t1l & 65535);
    c2 = (dl >>> 16) + (t1l >>> 16) + (c1 >>> 16);
    c3 = (dh & 65535) + (t1h & 65535) + (c2 >>> 16);
    c4 = (dh >>> 16) + (t1h >>> 16) + (c3 >>> 16);
    hh = c4 << 16 | c3 & 65535;
    hl = c2 << 16 | c1 & 65535;
    c1 = (t2l & 65535) + (t1l & 65535);
    c2 = (t2l >>> 16) + (t1l >>> 16) + (c1 >>> 16);
    c3 = (t2h & 65535) + (t1h & 65535) + (c2 >>> 16);
    c4 = (t2h >>> 16) + (t1h >>> 16) + (c3 >>> 16);
    dh = c4 << 16 | c3 & 65535;
    dl = c2 << 16 | c1 & 65535;
    s0h = (dh >>> 28 | dl << 4) ^ (dl >>> 2 | dh << 30) ^ (dl >>> 7 | dh << 25);
    s0l = (dl >>> 28 | dh << 4) ^ (dh >>> 2 | dl << 30) ^ (dh >>> 7 | dl << 25);
    s1h = (hh >>> 14 | hl << 18) ^ (hh >>> 18 | hl << 14) ^ (hl >>> 9 | hh << 23);
    s1l = (hl >>> 14 | hh << 18) ^ (hl >>> 18 | hh << 14) ^ (hh >>> 9 | hl << 23);
    dah = dh & ah;
    dal = dl & al;
    majh = dah ^ dh & bh ^ abh;
    majl = dal ^ dl & bl ^ abl;
    chh = hh & eh ^ ~hh & fh;
    chl = hl & el ^ ~hl & fl;
    t1h = blocks2[j + 2];
    t1l = blocks2[j + 3];
    t2h = K[j + 2];
    t2l = K[j + 3];
    c1 = (t2l & 65535) + (t1l & 65535) + (chl & 65535) + (s1l & 65535) + (gl & 65535);
    c2 = (t2l >>> 16) + (t1l >>> 16) + (chl >>> 16) + (s1l >>> 16) + (gl >>> 16) + (c1 >>> 16);
    c3 = (t2h & 65535) + (t1h & 65535) + (chh & 65535) + (s1h & 65535) + (gh & 65535) + (c2 >>> 16);
    c4 = (t2h >>> 16) + (t1h >>> 16) + (chh >>> 16) + (s1h >>> 16) + (gh >>> 16) + (c3 >>> 16);
    t1h = c4 << 16 | c3 & 65535;
    t1l = c2 << 16 | c1 & 65535;
    c1 = (majl & 65535) + (s0l & 65535);
    c2 = (majl >>> 16) + (s0l >>> 16) + (c1 >>> 16);
    c3 = (majh & 65535) + (s0h & 65535) + (c2 >>> 16);
    c4 = (majh >>> 16) + (s0h >>> 16) + (c3 >>> 16);
    t2h = c4 << 16 | c3 & 65535;
    t2l = c2 << 16 | c1 & 65535;
    c1 = (cl & 65535) + (t1l & 65535);
    c2 = (cl >>> 16) + (t1l >>> 16) + (c1 >>> 16);
    c3 = (ch & 65535) + (t1h & 65535) + (c2 >>> 16);
    c4 = (ch >>> 16) + (t1h >>> 16) + (c3 >>> 16);
    gh = c4 << 16 | c3 & 65535;
    gl = c2 << 16 | c1 & 65535;
    c1 = (t2l & 65535) + (t1l & 65535);
    c2 = (t2l >>> 16) + (t1l >>> 16) + (c1 >>> 16);
    c3 = (t2h & 65535) + (t1h & 65535) + (c2 >>> 16);
    c4 = (t2h >>> 16) + (t1h >>> 16) + (c3 >>> 16);
    ch = c4 << 16 | c3 & 65535;
    cl = c2 << 16 | c1 & 65535;
    s0h = (ch >>> 28 | cl << 4) ^ (cl >>> 2 | ch << 30) ^ (cl >>> 7 | ch << 25);
    s0l = (cl >>> 28 | ch << 4) ^ (ch >>> 2 | cl << 30) ^ (ch >>> 7 | cl << 25);
    s1h = (gh >>> 14 | gl << 18) ^ (gh >>> 18 | gl << 14) ^ (gl >>> 9 | gh << 23);
    s1l = (gl >>> 14 | gh << 18) ^ (gl >>> 18 | gh << 14) ^ (gh >>> 9 | gl << 23);
    cdh = ch & dh;
    cdl = cl & dl;
    majh = cdh ^ ch & ah ^ dah;
    majl = cdl ^ cl & al ^ dal;
    chh = gh & hh ^ ~gh & eh;
    chl = gl & hl ^ ~gl & el;
    t1h = blocks2[j + 4];
    t1l = blocks2[j + 5];
    t2h = K[j + 4];
    t2l = K[j + 5];
    c1 = (t2l & 65535) + (t1l & 65535) + (chl & 65535) + (s1l & 65535) + (fl & 65535);
    c2 = (t2l >>> 16) + (t1l >>> 16) + (chl >>> 16) + (s1l >>> 16) + (fl >>> 16) + (c1 >>> 16);
    c3 = (t2h & 65535) + (t1h & 65535) + (chh & 65535) + (s1h & 65535) + (fh & 65535) + (c2 >>> 16);
    c4 = (t2h >>> 16) + (t1h >>> 16) + (chh >>> 16) + (s1h >>> 16) + (fh >>> 16) + (c3 >>> 16);
    t1h = c4 << 16 | c3 & 65535;
    t1l = c2 << 16 | c1 & 65535;
    c1 = (majl & 65535) + (s0l & 65535);
    c2 = (majl >>> 16) + (s0l >>> 16) + (c1 >>> 16);
    c3 = (majh & 65535) + (s0h & 65535) + (c2 >>> 16);
    c4 = (majh >>> 16) + (s0h >>> 16) + (c3 >>> 16);
    t2h = c4 << 16 | c3 & 65535;
    t2l = c2 << 16 | c1 & 65535;
    c1 = (bl & 65535) + (t1l & 65535);
    c2 = (bl >>> 16) + (t1l >>> 16) + (c1 >>> 16);
    c3 = (bh & 65535) + (t1h & 65535) + (c2 >>> 16);
    c4 = (bh >>> 16) + (t1h >>> 16) + (c3 >>> 16);
    fh = c4 << 16 | c3 & 65535;
    fl = c2 << 16 | c1 & 65535;
    c1 = (t2l & 65535) + (t1l & 65535);
    c2 = (t2l >>> 16) + (t1l >>> 16) + (c1 >>> 16);
    c3 = (t2h & 65535) + (t1h & 65535) + (c2 >>> 16);
    c4 = (t2h >>> 16) + (t1h >>> 16) + (c3 >>> 16);
    bh = c4 << 16 | c3 & 65535;
    bl = c2 << 16 | c1 & 65535;
    s0h = (bh >>> 28 | bl << 4) ^ (bl >>> 2 | bh << 30) ^ (bl >>> 7 | bh << 25);
    s0l = (bl >>> 28 | bh << 4) ^ (bh >>> 2 | bl << 30) ^ (bh >>> 7 | bl << 25);
    s1h = (fh >>> 14 | fl << 18) ^ (fh >>> 18 | fl << 14) ^ (fl >>> 9 | fh << 23);
    s1l = (fl >>> 14 | fh << 18) ^ (fl >>> 18 | fh << 14) ^ (fh >>> 9 | fl << 23);
    bch = bh & ch;
    bcl = bl & cl;
    majh = bch ^ bh & dh ^ cdh;
    majl = bcl ^ bl & dl ^ cdl;
    chh = fh & gh ^ ~fh & hh;
    chl = fl & gl ^ ~fl & hl;
    t1h = blocks2[j + 6];
    t1l = blocks2[j + 7];
    t2h = K[j + 6];
    t2l = K[j + 7];
    c1 = (t2l & 65535) + (t1l & 65535) + (chl & 65535) + (s1l & 65535) + (el & 65535);
    c2 = (t2l >>> 16) + (t1l >>> 16) + (chl >>> 16) + (s1l >>> 16) + (el >>> 16) + (c1 >>> 16);
    c3 = (t2h & 65535) + (t1h & 65535) + (chh & 65535) + (s1h & 65535) + (eh & 65535) + (c2 >>> 16);
    c4 = (t2h >>> 16) + (t1h >>> 16) + (chh >>> 16) + (s1h >>> 16) + (eh >>> 16) + (c3 >>> 16);
    t1h = c4 << 16 | c3 & 65535;
    t1l = c2 << 16 | c1 & 65535;
    c1 = (majl & 65535) + (s0l & 65535);
    c2 = (majl >>> 16) + (s0l >>> 16) + (c1 >>> 16);
    c3 = (majh & 65535) + (s0h & 65535) + (c2 >>> 16);
    c4 = (majh >>> 16) + (s0h >>> 16) + (c3 >>> 16);
    t2h = c4 << 16 | c3 & 65535;
    t2l = c2 << 16 | c1 & 65535;
    c1 = (al & 65535) + (t1l & 65535);
    c2 = (al >>> 16) + (t1l >>> 16) + (c1 >>> 16);
    c3 = (ah & 65535) + (t1h & 65535) + (c2 >>> 16);
    c4 = (ah >>> 16) + (t1h >>> 16) + (c3 >>> 16);
    eh = c4 << 16 | c3 & 65535;
    el = c2 << 16 | c1 & 65535;
    c1 = (t2l & 65535) + (t1l & 65535);
    c2 = (t2l >>> 16) + (t1l >>> 16) + (c1 >>> 16);
    c3 = (t2h & 65535) + (t1h & 65535) + (c2 >>> 16);
    c4 = (t2h >>> 16) + (t1h >>> 16) + (c3 >>> 16);
    ah = c4 << 16 | c3 & 65535;
    al = c2 << 16 | c1 & 65535;
  }
  c1 = (h0l & 65535) + (al & 65535);
  c2 = (h0l >>> 16) + (al >>> 16) + (c1 >>> 16);
  c3 = (h0h & 65535) + (ah & 65535) + (c2 >>> 16);
  c4 = (h0h >>> 16) + (ah >>> 16) + (c3 >>> 16);
  this.h0h = c4 << 16 | c3 & 65535;
  this.h0l = c2 << 16 | c1 & 65535;
  c1 = (h1l & 65535) + (bl & 65535);
  c2 = (h1l >>> 16) + (bl >>> 16) + (c1 >>> 16);
  c3 = (h1h & 65535) + (bh & 65535) + (c2 >>> 16);
  c4 = (h1h >>> 16) + (bh >>> 16) + (c3 >>> 16);
  this.h1h = c4 << 16 | c3 & 65535;
  this.h1l = c2 << 16 | c1 & 65535;
  c1 = (h2l & 65535) + (cl & 65535);
  c2 = (h2l >>> 16) + (cl >>> 16) + (c1 >>> 16);
  c3 = (h2h & 65535) + (ch & 65535) + (c2 >>> 16);
  c4 = (h2h >>> 16) + (ch >>> 16) + (c3 >>> 16);
  this.h2h = c4 << 16 | c3 & 65535;
  this.h2l = c2 << 16 | c1 & 65535;
  c1 = (h3l & 65535) + (dl & 65535);
  c2 = (h3l >>> 16) + (dl >>> 16) + (c1 >>> 16);
  c3 = (h3h & 65535) + (dh & 65535) + (c2 >>> 16);
  c4 = (h3h >>> 16) + (dh >>> 16) + (c3 >>> 16);
  this.h3h = c4 << 16 | c3 & 65535;
  this.h3l = c2 << 16 | c1 & 65535;
  c1 = (h4l & 65535) + (el & 65535);
  c2 = (h4l >>> 16) + (el >>> 16) + (c1 >>> 16);
  c3 = (h4h & 65535) + (eh & 65535) + (c2 >>> 16);
  c4 = (h4h >>> 16) + (eh >>> 16) + (c3 >>> 16);
  this.h4h = c4 << 16 | c3 & 65535;
  this.h4l = c2 << 16 | c1 & 65535;
  c1 = (h5l & 65535) + (fl & 65535);
  c2 = (h5l >>> 16) + (fl >>> 16) + (c1 >>> 16);
  c3 = (h5h & 65535) + (fh & 65535) + (c2 >>> 16);
  c4 = (h5h >>> 16) + (fh >>> 16) + (c3 >>> 16);
  this.h5h = c4 << 16 | c3 & 65535;
  this.h5l = c2 << 16 | c1 & 65535;
  c1 = (h6l & 65535) + (gl & 65535);
  c2 = (h6l >>> 16) + (gl >>> 16) + (c1 >>> 16);
  c3 = (h6h & 65535) + (gh & 65535) + (c2 >>> 16);
  c4 = (h6h >>> 16) + (gh >>> 16) + (c3 >>> 16);
  this.h6h = c4 << 16 | c3 & 65535;
  this.h6l = c2 << 16 | c1 & 65535;
  c1 = (h7l & 65535) + (hl & 65535);
  c2 = (h7l >>> 16) + (hl >>> 16) + (c1 >>> 16);
  c3 = (h7h & 65535) + (hh & 65535) + (c2 >>> 16);
  c4 = (h7h >>> 16) + (hh >>> 16) + (c3 >>> 16);
  this.h7h = c4 << 16 | c3 & 65535;
  this.h7l = c2 << 16 | c1 & 65535;
};
Sha512.prototype.hex = function() {
  this.finalize();
  const h0h = this.h0h;
  const h0l = this.h0l;
  const h1h = this.h1h;
  const h1l = this.h1l;
  const h2h = this.h2h;
  const h2l = this.h2l;
  const h3h = this.h3h;
  const h3l = this.h3l;
  const h4h = this.h4h;
  const h4l = this.h4l;
  const h5h = this.h5h;
  const h5l = this.h5l;
  const h6h = this.h6h;
  const h6l = this.h6l;
  const h7h = this.h7h;
  const h7l = this.h7l;
  const bits = this.bits;
  let hex = HEX_CHARS[h0h >>> 28 & 15] + HEX_CHARS[h0h >>> 24 & 15] + HEX_CHARS[h0h >>> 20 & 15] + HEX_CHARS[h0h >>> 16 & 15] + HEX_CHARS[h0h >>> 12 & 15] + HEX_CHARS[h0h >>> 8 & 15] + HEX_CHARS[h0h >>> 4 & 15] + HEX_CHARS[h0h & 15] + HEX_CHARS[h0l >>> 28 & 15] + HEX_CHARS[h0l >>> 24 & 15] + HEX_CHARS[h0l >>> 20 & 15] + HEX_CHARS[h0l >>> 16 & 15] + HEX_CHARS[h0l >>> 12 & 15] + HEX_CHARS[h0l >>> 8 & 15] + HEX_CHARS[h0l >>> 4 & 15] + HEX_CHARS[h0l & 15] + HEX_CHARS[h1h >>> 28 & 15] + HEX_CHARS[h1h >>> 24 & 15] + HEX_CHARS[h1h >>> 20 & 15] + HEX_CHARS[h1h >>> 16 & 15] + HEX_CHARS[h1h >>> 12 & 15] + HEX_CHARS[h1h >>> 8 & 15] + HEX_CHARS[h1h >>> 4 & 15] + HEX_CHARS[h1h & 15] + HEX_CHARS[h1l >>> 28 & 15] + HEX_CHARS[h1l >>> 24 & 15] + HEX_CHARS[h1l >>> 20 & 15] + HEX_CHARS[h1l >>> 16 & 15] + HEX_CHARS[h1l >>> 12 & 15] + HEX_CHARS[h1l >>> 8 & 15] + HEX_CHARS[h1l >>> 4 & 15] + HEX_CHARS[h1l & 15] + HEX_CHARS[h2h >>> 28 & 15] + HEX_CHARS[h2h >>> 24 & 15] + HEX_CHARS[h2h >>> 20 & 15] + HEX_CHARS[h2h >>> 16 & 15] + HEX_CHARS[h2h >>> 12 & 15] + HEX_CHARS[h2h >>> 8 & 15] + HEX_CHARS[h2h >>> 4 & 15] + HEX_CHARS[h2h & 15] + HEX_CHARS[h2l >>> 28 & 15] + HEX_CHARS[h2l >>> 24 & 15] + HEX_CHARS[h2l >>> 20 & 15] + HEX_CHARS[h2l >>> 16 & 15] + HEX_CHARS[h2l >>> 12 & 15] + HEX_CHARS[h2l >>> 8 & 15] + HEX_CHARS[h2l >>> 4 & 15] + HEX_CHARS[h2l & 15] + HEX_CHARS[h3h >>> 28 & 15] + HEX_CHARS[h3h >>> 24 & 15] + HEX_CHARS[h3h >>> 20 & 15] + HEX_CHARS[h3h >>> 16 & 15] + HEX_CHARS[h3h >>> 12 & 15] + HEX_CHARS[h3h >>> 8 & 15] + HEX_CHARS[h3h >>> 4 & 15] + HEX_CHARS[h3h & 15];
  if (bits >= 256) {
    hex += HEX_CHARS[h3l >>> 28 & 15] + HEX_CHARS[h3l >>> 24 & 15] + HEX_CHARS[h3l >>> 20 & 15] + HEX_CHARS[h3l >>> 16 & 15] + HEX_CHARS[h3l >>> 12 & 15] + HEX_CHARS[h3l >>> 8 & 15] + HEX_CHARS[h3l >>> 4 & 15] + HEX_CHARS[h3l & 15];
  }
  if (bits >= 384) {
    hex += HEX_CHARS[h4h >>> 28 & 15] + HEX_CHARS[h4h >>> 24 & 15] + HEX_CHARS[h4h >>> 20 & 15] + HEX_CHARS[h4h >>> 16 & 15] + HEX_CHARS[h4h >>> 12 & 15] + HEX_CHARS[h4h >>> 8 & 15] + HEX_CHARS[h4h >>> 4 & 15] + HEX_CHARS[h4h & 15] + HEX_CHARS[h4l >>> 28 & 15] + HEX_CHARS[h4l >>> 24 & 15] + HEX_CHARS[h4l >>> 20 & 15] + HEX_CHARS[h4l >>> 16 & 15] + HEX_CHARS[h4l >>> 12 & 15] + HEX_CHARS[h4l >>> 8 & 15] + HEX_CHARS[h4l >>> 4 & 15] + HEX_CHARS[h4l & 15] + HEX_CHARS[h5h >>> 28 & 15] + HEX_CHARS[h5h >>> 24 & 15] + HEX_CHARS[h5h >>> 20 & 15] + HEX_CHARS[h5h >>> 16 & 15] + HEX_CHARS[h5h >>> 12 & 15] + HEX_CHARS[h5h >>> 8 & 15] + HEX_CHARS[h5h >>> 4 & 15] + HEX_CHARS[h5h & 15] + HEX_CHARS[h5l >>> 28 & 15] + HEX_CHARS[h5l >>> 24 & 15] + HEX_CHARS[h5l >>> 20 & 15] + HEX_CHARS[h5l >>> 16 & 15] + HEX_CHARS[h5l >>> 12 & 15] + HEX_CHARS[h5l >>> 8 & 15] + HEX_CHARS[h5l >>> 4 & 15] + HEX_CHARS[h5l & 15];
  }
  if (bits == 512) {
    hex += HEX_CHARS[h6h >>> 28 & 15] + HEX_CHARS[h6h >>> 24 & 15] + HEX_CHARS[h6h >>> 20 & 15] + HEX_CHARS[h6h >>> 16 & 15] + HEX_CHARS[h6h >>> 12 & 15] + HEX_CHARS[h6h >>> 8 & 15] + HEX_CHARS[h6h >>> 4 & 15] + HEX_CHARS[h6h & 15] + HEX_CHARS[h6l >>> 28 & 15] + HEX_CHARS[h6l >>> 24 & 15] + HEX_CHARS[h6l >>> 20 & 15] + HEX_CHARS[h6l >>> 16 & 15] + HEX_CHARS[h6l >>> 12 & 15] + HEX_CHARS[h6l >>> 8 & 15] + HEX_CHARS[h6l >>> 4 & 15] + HEX_CHARS[h6l & 15] + HEX_CHARS[h7h >>> 28 & 15] + HEX_CHARS[h7h >>> 24 & 15] + HEX_CHARS[h7h >>> 20 & 15] + HEX_CHARS[h7h >>> 16 & 15] + HEX_CHARS[h7h >>> 12 & 15] + HEX_CHARS[h7h >>> 8 & 15] + HEX_CHARS[h7h >>> 4 & 15] + HEX_CHARS[h7h & 15] + HEX_CHARS[h7l >>> 28 & 15] + HEX_CHARS[h7l >>> 24 & 15] + HEX_CHARS[h7l >>> 20 & 15] + HEX_CHARS[h7l >>> 16 & 15] + HEX_CHARS[h7l >>> 12 & 15] + HEX_CHARS[h7l >>> 8 & 15] + HEX_CHARS[h7l >>> 4 & 15] + HEX_CHARS[h7l & 15];
  }
  return hex;
};
Sha512.prototype.toString = Sha512.prototype.hex;
Sha512.prototype.digest = function() {
  this.finalize();
  const h0h = this.h0h;
  const h0l = this.h0l;
  const h1h = this.h1h;
  const h1l = this.h1l;
  const h2h = this.h2h;
  const h2l = this.h2l;
  const h3h = this.h3h;
  const h3l = this.h3l;
  const h4h = this.h4h;
  const h4l = this.h4l;
  const h5h = this.h5h;
  const h5l = this.h5l;
  const h6h = this.h6h;
  const h6l = this.h6l;
  const h7h = this.h7h;
  const h7l = this.h7l;
  const bits = this.bits;
  const arr = [
    h0h >>> 24 & 255,
    h0h >>> 16 & 255,
    h0h >>> 8 & 255,
    h0h & 255,
    h0l >>> 24 & 255,
    h0l >>> 16 & 255,
    h0l >>> 8 & 255,
    h0l & 255,
    h1h >>> 24 & 255,
    h1h >>> 16 & 255,
    h1h >>> 8 & 255,
    h1h & 255,
    h1l >>> 24 & 255,
    h1l >>> 16 & 255,
    h1l >>> 8 & 255,
    h1l & 255,
    h2h >>> 24 & 255,
    h2h >>> 16 & 255,
    h2h >>> 8 & 255,
    h2h & 255,
    h2l >>> 24 & 255,
    h2l >>> 16 & 255,
    h2l >>> 8 & 255,
    h2l & 255,
    h3h >>> 24 & 255,
    h3h >>> 16 & 255,
    h3h >>> 8 & 255,
    h3h & 255
  ];
  if (bits >= 256) {
    arr.push(
      h3l >>> 24 & 255,
      h3l >>> 16 & 255,
      h3l >>> 8 & 255,
      h3l & 255
    );
  }
  if (bits >= 384) {
    arr.push(
      h4h >>> 24 & 255,
      h4h >>> 16 & 255,
      h4h >>> 8 & 255,
      h4h & 255,
      h4l >>> 24 & 255,
      h4l >>> 16 & 255,
      h4l >>> 8 & 255,
      h4l & 255,
      h5h >>> 24 & 255,
      h5h >>> 16 & 255,
      h5h >>> 8 & 255,
      h5h & 255,
      h5l >>> 24 & 255,
      h5l >>> 16 & 255,
      h5l >>> 8 & 255,
      h5l & 255
    );
  }
  if (bits == 512) {
    arr.push(
      h6h >>> 24 & 255,
      h6h >>> 16 & 255,
      h6h >>> 8 & 255,
      h6h & 255,
      h6l >>> 24 & 255,
      h6l >>> 16 & 255,
      h6l >>> 8 & 255,
      h6l & 255,
      h7h >>> 24 & 255,
      h7h >>> 16 & 255,
      h7h >>> 8 & 255,
      h7h & 255,
      h7l >>> 24 & 255,
      h7l >>> 16 & 255,
      h7l >>> 8 & 255,
      h7l & 255
    );
  }
  return arr;
};
Sha512.prototype.array = Sha512.prototype.digest;
Sha512.prototype.arrayBuffer = function() {
  this.finalize();
  const bits = this.bits;
  const buffer = new ArrayBuffer(bits / 8);
  const dataView = new DataView(buffer);
  dataView.setUint32(0, this.h0h);
  dataView.setUint32(4, this.h0l);
  dataView.setUint32(8, this.h1h);
  dataView.setUint32(12, this.h1l);
  dataView.setUint32(16, this.h2h);
  dataView.setUint32(20, this.h2l);
  dataView.setUint32(24, this.h3h);
  if (bits >= 256) {
    dataView.setUint32(28, this.h3l);
  }
  if (bits >= 384) {
    dataView.setUint32(32, this.h4h);
    dataView.setUint32(36, this.h4l);
    dataView.setUint32(40, this.h5h);
    dataView.setUint32(44, this.h5l);
  }
  if (bits == 512) {
    dataView.setUint32(48, this.h6h);
    dataView.setUint32(52, this.h6l);
    dataView.setUint32(56, this.h7h);
    dataView.setUint32(60, this.h7l);
  }
  return buffer;
};
Sha512.prototype.clone = function() {
  const hash = new Sha512(this.bits, false);
  this.copyTo(hash);
  return hash;
};
Sha512.prototype.copyTo = function(hash) {
  let i = 0;
  const attrs = [
    "h0h",
    "h0l",
    "h1h",
    "h1l",
    "h2h",
    "h2l",
    "h3h",
    "h3l",
    "h4h",
    "h4l",
    "h5h",
    "h5l",
    "h6h",
    "h6l",
    "h7h",
    "h7l",
    "start",
    "bytes",
    "hBytes",
    "finalized",
    "hashed",
    "lastByteIndex"
  ];
  for (i = 0; i < attrs.length; ++i) {
    hash[attrs[i]] = this[attrs[i]];
  }
  for (i = 0; i < this.blocks.length; ++i) {
    hash.blocks[i] = this.blocks[i];
  }
};
export {
  createMethod
};
//# sourceMappingURL=sha512.js.map
