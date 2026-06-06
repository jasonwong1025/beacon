// Generates Beacon's icon PNGs (16/32/48/128) with no external dependencies.
// Draws a dark rounded-square badge with concentric "beacon" rings.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
const DOCS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'icons');
mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(DOCS_DIR, { recursive: true });

// ---- tiny PNG encoder (RGBA, 8-bit) ----
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(raw, { level: 9 });

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- drawing helpers ----
function hex(h) {
  return [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ];
}

const COLORS = {
  bg1: hex('#193fb4'),
  bg2: hex('#0f1525'),
  ringOuter: hex('#3380fc'),
  ringInner: hex('#8ec5ff'),
  core: hex('#ffffff'),
};

function draw(size) {
  const buf = Buffer.alloc(size * size * 4);
  const c = (size - 1) / 2;
  const radius = size * 0.5;
  const corner = size * 0.26;

  const blend = (px, py, color, alpha) => {
    if (alpha <= 0) return;
    const i = (py * size + px) * 4;
    const a = Math.min(1, alpha);
    buf[i] = Math.round(buf[i] * (1 - a) + color[0] * a);
    buf[i + 1] = Math.round(buf[i + 1] * (1 - a) + color[1] * a);
    buf[i + 2] = Math.round(buf[i + 2] * (1 - a) + color[2] * a);
    buf[i + 3] = Math.max(buf[i + 3], Math.round(255 * a));
  };

  // rounded-rect coverage for the badge background (with vertical gradient)
  const inRounded = (x, y) => {
    const rx = Math.min(x, size - 1 - x);
    const ry = Math.min(y, size - 1 - y);
    if (rx >= corner || ry >= corner) return 1;
    const dx = corner - rx;
    const dy = corner - ry;
    const d = Math.sqrt(dx * dx + dy * dy);
    return Math.max(0, Math.min(1, corner - d + 0.5));
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const cov = inRounded(x, y);
      if (cov <= 0) continue;
      const t = y / (size - 1);
      const bg = [
        Math.round(COLORS.bg1[0] * (1 - t) + COLORS.bg2[0] * t),
        Math.round(COLORS.bg1[1] * (1 - t) + COLORS.bg2[1] * t),
        Math.round(COLORS.bg1[2] * (1 - t) + COLORS.bg2[2] * t),
      ];
      blend(x, y, bg, cov);
    }
  }

  // ring drawer (anti-aliased annulus)
  const ring = (rOuter, rInner, color) => {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const d = Math.sqrt((x - c) ** 2 + (y - c) ** 2);
        const outer = Math.max(0, Math.min(1, rOuter - d + 0.5));
        const inner = Math.max(0, Math.min(1, d - rInner + 0.5));
        const cov = Math.min(outer, inner);
        if (cov > 0) blend(x, y, color, cov);
      }
    }
  };

  const lw = Math.max(1, size * 0.06);
  ring(radius * 0.78, radius * 0.78 - lw, COLORS.ringOuter);
  ring(radius * 0.46, radius * 0.46 - lw, COLORS.ringInner);

  // core dot
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.sqrt((x - c) ** 2 + (y - c) ** 2);
      const cov = Math.max(0, Math.min(1, radius * 0.16 - d + 0.5));
      if (cov > 0) blend(x, y, COLORS.core, cov);
    }
  }

  return encodePNG(size, size, buf);
}

for (const size of [16, 32, 48, 128]) {
  const png = draw(size);
  for (const dir of [OUT_DIR, DOCS_DIR]) {
    writeFileSync(join(dir, `icon${size}.png`), png);
  }
  console.log(`wrote icon${size}.png (${png.length} bytes)`);
}
