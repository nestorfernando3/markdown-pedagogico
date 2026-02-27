const [major] = process.versions.node.split('.').map(Number);

if (Number.isNaN(major) || major < 22 || major >= 23) {
  console.error('');
  console.error('ERROR: This project requires Node.js 22.x (>=22 <23).');
  console.error(`Current Node.js version: ${process.versions.node}`);
  console.error('');
  console.error('Fix:');
  console.error('  Option A (with nvm):');
  console.error('    1) nvm install 22');
  console.error('    2) nvm use 22');
  console.error('  Option B (with Homebrew):');
  console.error('    1) brew install node@22');
  console.error('    2) export PATH="$(brew --prefix node@22)/bin:$PATH"');
  console.error('  Then: npm ci');
  process.exit(1);
}

console.log(`Node.js ${process.versions.node} is compatible.`);
