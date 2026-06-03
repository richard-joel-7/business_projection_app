import { build } from 'vite';

async function runBuild() {
  try {
    await build({
      root: process.cwd(),
      logLevel: 'error',
    });
    console.log('Build completed successfully.');
  } catch (err) {
    console.error('Build failed with error:', err);
    process.exit(1);
  }
}

runBuild();