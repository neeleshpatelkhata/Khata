const fs = require('fs');
const path = require('path');

const srcRelease = path.join(__dirname, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
const dstRelease = path.join(__dirname, 'Khata_Ledger_Release.apk');

const srcDebug = path.join(__dirname, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
const dstDebug = path.join(__dirname, 'Khata_Ledger_Debug.apk');

if (fs.existsSync(srcRelease)) {
  fs.copyFileSync(srcRelease, dstRelease);
  console.log('✅ Copied Release APK to:', dstRelease);
}

if (fs.existsSync(srcDebug)) {
  fs.copyFileSync(srcDebug, dstDebug);
  console.log('✅ Copied Debug APK to:', dstDebug);
}
