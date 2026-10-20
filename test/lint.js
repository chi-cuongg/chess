// ========================================
// Lightweight lint: syntax-check every JS file
// ========================================
// No external dependencies. Runs `node --check` on each script so syntax
// errors are caught without a full ESLint setup.
//     npm run lint

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');

function collectJsFiles(dir) {
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            out.push(...collectJsFiles(full));
        } else if (/\.(?:js|mjs)$/.test(entry.name)) {
            out.push(full);
        }
    }
    return out;
}

const files = collectJsFiles(root);
let failures = 0;

for (const file of files) {
    const res = spawnSync(process.execPath, file.includes(path.sep + 'src' + path.sep) ? ['--input-type=module', '--check'] : ['--check', file], { encoding: 'utf8', input: file.includes(path.sep + 'src' + path.sep) ? fs.readFileSync(file, 'utf8') : undefined });
    if (res.status !== 0) {
        failures++;
        console.error(`  FAIL ${path.relative(root, file)}`);
        console.error((res.stderr || '').trim());
    } else {
        console.log(`  ok   ${path.relative(root, file)}`);
    }
}

console.log(`\n${files.length - failures}/${files.length} files OK`);
if (failures > 0) process.exitCode = 1;
