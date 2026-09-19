const fs = require('fs');
const https = require('https');
const { execSync } = require('child_process');

const targetZip = 'C:\\Users\\HP\\jdk17.zip';
const targetDir = 'C:\\Users\\HP\\jdk17';

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

function download(url) {
  console.log('Fetching:', url.substring(0, 80) + '...');
  https.get(url, (res) => {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      res.resume();
      download(res.headers.location);
      return;
    }
    if (res.statusCode !== 200) {
      console.error('Failed with status:', res.statusCode);
      return;
    }
    const file = fs.createWriteStream(targetZip);
    res.pipe(file);
    file.on('finish', () => {
      file.close(() => {
        const size = fs.statSync(targetZip).size;
        console.log('Download finished. File size:', (size / (1024 * 1024)).toFixed(2), 'MB');
        if (size > 1000000) {
          try {
            console.log('Extracting using tar...');
            execSync(`tar -xf "${targetZip}" -C "${targetDir}"`);
            console.log('Extracted successfully!');
          } catch (e) {
            console.error('Extract error:', e.message);
          }
        }
      });
    });
  }).on('error', (err) => {
    console.error('Download error:', err.message);
  });
}

download('https://api.adoptium.net/v3/binary/latest/17/ga/windows/x64/jdk/hotspot/normal/eclipse');
