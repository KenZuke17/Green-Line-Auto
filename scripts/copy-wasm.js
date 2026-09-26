const fs = require('fs');
const path = require('path');

const source = path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
const target = path.join(__dirname, '..', 'sql-wasm.wasm');

if (!fs.existsSync(source)) {
  console.error(`Source wasm file not found: ${source}`);
  process.exit(1);
}

fs.copyFileSync(source, target);
console.log(`Copied ${source} to ${target}`);
