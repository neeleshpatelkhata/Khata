const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Generate a valid 48x48, 72x72, 96x96, 144x144, 192x192 PNG buffer in pure Node.js
function createPNG(width, height, r, g, b, a) {
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  
  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  
  const ihdrChunk = createChunk('IHDR', ihdr);

  // Raw pixel data with filter byte 0 at start of each line
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(height * rowSize);
  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter type 0
    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  const compressedData = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressedData);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crc = crc32(body);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc, 0);
  return Buffer.concat([len, body, crcBuf]);
}

function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    let byte = buf[i];
    crc ^= byte;
    for (let j = 0; j < 8; j++) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xEDB88320 & mask);
    }
  }
  return (crc ^ -1) >>> 0;
}

const resDir = path.join(__dirname, 'android', 'app', 'src', 'main', 'res');
const sizes = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192
};

console.log('🎨 Generating pristine Android MIPMAP launcher PNG icons...');

for (const [folder, dim] of Object.entries(sizes)) {
  const targetFolder = path.join(resDir, folder);
  if (!fs.existsSync(targetFolder)) {
    fs.mkdirSync(targetFolder, { recursive: true });
  }

  // Dark indigo/cyan theme brand icon colors (RGBA: 15, 23, 42, 255)
  const pngBuffer = createPNG(dim, dim, 15, 23, 42, 255);

  fs.writeFileSync(path.join(targetFolder, 'ic_launcher.png'), pngBuffer);
  fs.writeFileSync(path.join(targetFolder, 'ic_launcher_round.png'), pngBuffer);
  fs.writeFileSync(path.join(targetFolder, 'ic_launcher_foreground.png'), pngBuffer);
  console.log(`✅ Clean PNG icons written for ${folder} (${dim}x${dim})`);
}

console.log('🎉 All Android mipmap PNG assets generated cleanly!');
