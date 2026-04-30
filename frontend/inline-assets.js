import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distDir = path.join(__dirname, 'dist');
const indexHtmlPath = path.join(distDir, 'index.html');

console.log('Current directory:', process.cwd());
console.log('__dirname:', __dirname);
console.log('Looking for index.html at:', indexHtmlPath);

if (!fs.existsSync(indexHtmlPath)) {
    console.error('dist/index.html not found. Run build first.');
    if (fs.existsSync(distDir)) {
        console.log('Contents of dist:', fs.readdirSync(distDir));
    } else {
        console.log('dist directory does not exist');
    }
    process.exit(1);
}

let html = fs.readFileSync(indexHtmlPath, 'utf-8');

// Inline CSS
const cssRegex = /<link rel="stylesheet" crossorigin href="([^"]+)">/;
let match;
while ((match = cssRegex.exec(html)) !== null) {
    let assetPath = match[1];
    if (assetPath.startsWith('/')) assetPath = assetPath.slice(1);
    const cssPath = path.join(distDir, assetPath);
    console.log(`Processing CSS: ${assetPath} -> ${cssPath}`);
    if (fs.existsSync(cssPath)) {
        const cssContent = fs.readFileSync(cssPath, 'utf-8');
        html = html.replace(match[0], () => `<style>${cssContent}</style>`);
        console.log('CSS Inlined');
    } else {
        console.warn(`CSS file not found: ${cssPath}`);
        break;
    }
}

// Inline JS
const jsRegex = /<script type="module" crossorigin src="([^"]+)">\<\/script>/;
while ((match = jsRegex.exec(html)) !== null) {
    let assetPath = match[1];
    if (assetPath.startsWith('/')) assetPath = assetPath.slice(1);
    const jsPath = path.join(distDir, assetPath);
    console.log(`Processing JS: ${assetPath} -> ${jsPath}`);
    if (fs.existsSync(jsPath)) {
        const jsContent = fs.readFileSync(jsPath, 'utf-8');
        html = html.replace(match[0], () => `<script type="module">${jsContent}</script>`);
        console.log('JS Inlined');
    } else {
        console.warn(`JS file not found: ${jsPath}`);
        break;
    }
}

// Write to backend
const backendDir = path.join(__dirname, '../backend');
if (!fs.existsSync(backendDir)) {
    fs.mkdirSync(backendDir);
}
fs.writeFileSync(path.join(backendDir, 'index.html'), html);

console.log('Assets inlined and written to backend/index.html');
