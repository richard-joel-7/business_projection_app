const { execSync } = require('child_process');
try {
  const result = execSync('node node_modules/vite/bin/vite.js build', { encoding: 'utf-8' });
  console.log(result);
} catch (err) {
  console.error("STDOUT:", err.stdout);
  console.error("STDERR:", err.stderr);
}