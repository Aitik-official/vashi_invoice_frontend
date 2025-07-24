const fs = require('fs');
const path = require('path');

const images = [
  { file: 'logo_wbg.png', out: 'logo_wbg.b64.txt' },
  { file: 'Stamp_mum.png', out: 'Stamp_mum.b64.txt' },
];

const dir = path.join(__dirname, 'public', 'inovice_formatting');

images.forEach(({ file, out }) => {
  const imgPath = path.join(dir, file);
  const outPath = path.join(dir, out);
  const data = fs.readFileSync(imgPath);
  const base64 = data.toString('base64');
  fs.writeFileSync(outPath, base64);
  console.log(`Converted ${file} to ${out}`);
}); 