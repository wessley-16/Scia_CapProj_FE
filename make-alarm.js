const fs = require("fs");
const path = require("path");
const sr = 22050;
const s = [];
const tone = (f, d) => {
  const n = Math.floor(sr * d);
  for (let i = 0; i < n; i++) {
    const e = Math.min(1, i / 300, (n - i) / 300);
    s.push(Math.round(32767 * 0.6 * e * Math.sin((2 * Math.PI * f * i) / sr)));
  }
};
const gap = (d) => {
  for (let i = 0; i < Math.floor(sr * d); i++) s.push(0);
};
for (let a = 0; a < 4; a++) {
  for (let b = 0; b < 3; b++) { tone(1000, 0.15); gap(0.08); }
  gap(0.35);
}
const buf = Buffer.alloc(44 + s.length * 2);
buf.write("RIFF", 0);
buf.writeUInt32LE(36 + s.length * 2, 4);
buf.write("WAVEfmt ", 8);
buf.writeUInt32LE(16, 16);
buf.writeUInt16LE(1, 20);
buf.writeUInt16LE(1, 22);
buf.writeUInt32LE(sr, 24);
buf.writeUInt32LE(sr * 2, 28);
buf.writeUInt16LE(2, 32);
buf.writeUInt16LE(16, 34);
buf.write("data", 36);
buf.writeUInt32LE(s.length * 2, 40);
s.forEach((v, i) => buf.writeInt16LE(v, 44 + i * 2));
fs.mkdirSync(path.join("assets", "sounds"), { recursive: true });
fs.writeFileSync(path.join("assets", "sounds", "alarm.wav"), buf);
console.log("Created assets/sounds/alarm.wav (" + buf.length + " bytes)");
