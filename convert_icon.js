const pngToIco = require('png-to-ico');
const fs = require('fs');

console.log('Type of pngToIco:', typeof pngToIco);
// console.log('pngToIco:', pngToIco); // Avoid circular structure issues or large output

const converter = typeof pngToIco === 'function' ? pngToIco : pngToIco.default;

if (typeof converter !== 'function') {
    // Check if it's nested
    if (pngToIco && typeof pngToIco === 'object') {
         console.error('Keys:', Object.keys(pngToIco));
    }
  throw new Error('pngToIco is not a function');
}

converter('build/icon.png')
  .then(buf => {
    fs.writeFileSync('build/icon.ico', buf);
    console.log('Icon converted successfully');
  })
  .catch(err => {
    console.error('Error converting icon:', err);
    process.exit(1);
  });
