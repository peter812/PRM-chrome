import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const INPUT_DIR = path.join(projectRoot, 'follower scraper example');
const OUTPUT_DIR = path.join(projectRoot, 'follower_scraper_decompiled');

console.log('=== Webpack Bundle Deobfuscator & Analyzer ===\n');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const targets = [
  { name: 'background', file: 'react-background-bundle.js' },
  { name: 'popup', file: 'react-popup-bundle.js' },
  { name: 'sw', file: 'sw.js' }
];

for (const target of targets) {
  const filePath = path.join(INPUT_DIR, target.file);
  const outSubDir = path.join(OUTPUT_DIR, target.name);

  if (!fs.existsSync(filePath)) {
    console.log(`[!] File not found: ${filePath}`);
    continue;
  }

  console.log(`\n--> Unpacking & Deobfuscating ${target.file} into ${target.name}/...`);
  if (!fs.existsSync(outSubDir)) {
    fs.mkdirSync(outSubDir, { recursive: true });
  }

  try {
    const cmd = `npx --yes webcrack "${filePath}" -o "${outSubDir}" -f`;
    execSync(cmd, { stdio: 'inherit' });
    console.log(`[+] Successfully unpacked ${target.name}`);
  } catch (err) {
    console.error(`[-] Failed unpacking ${target.file}:`, err.message);
  }
}

// Post-Processing: Extract Insights & Signatures
console.log('\n--> Analyzing decompiled modules for API endpoints, messages, and storage keys...');

const findings = {
  apiEndpoints: new Set(),
  graphQlQueries: new Set(),
  chromeMessages: new Set(),
  storageKeys: new Set()
};

function scanDir(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      const code = fs.readFileSync(fullPath, 'utf8');

      // URLs & Endpoints
      const urls = code.match(/https?:\/\/[^\s"'`)]+/g) || [];
      urls.forEach(u => findings.apiEndpoints.add(u));

      const apiPaths = code.match(/\/api\/v\d+\/[^\s"'`)]+|\/graphql\/query[^\s"'`)]*/g) || [];
      apiPaths.forEach(p => findings.apiEndpoints.add(p));

      // Doc IDs / Query Hashes
      const hashes = code.match(/query_hash["']?\s*:\s*["']([a-f0-9]+)["']|doc_id["']?\s*:\s*["'](\d+)["']/g) || [];
      hashes.forEach(h => findings.graphQlQueries.add(h));

      // Chrome Messages (e.g., action: "...", type: "...")
      const actions = code.match(/(?:action|type|event)\s*:\s*["']([A-Za-z0-9_-]+)["']/g) || [];
      actions.forEach(a => findings.chromeMessages.add(a));

      // Storage keys
      const storage = code.match(/(?:storage\.local|storage\.sync)\.(?:get|set|remove)\(\s*(?:\[([^\]]+)\]|["']([^"']+)["'])/g) || [];
      storage.forEach(s => findings.storageKeys.add(s));
    }
  }
}

scanDir(OUTPUT_DIR);

const analysisReport = `# Follower Scraper Example - Decompiled Analysis Report

Generated at: ${new Date().toISOString()}

## 1. Discovered API Endpoints & URLs
${Array.from(findings.apiEndpoints).map(e => `- \`${e}\``).join('\n') || '- None found'}

## 2. GraphQL Hashes / Doc IDs
${Array.from(findings.graphQlQueries).map(q => `- \`${q}\``).join('\n') || '- None found'}

## 3. Chrome Message Actions
${Array.from(findings.chromeMessages).map(m => `- \`${m}\``).join('\n') || '- None found'}

## 4. Chrome Storage Keys
${Array.from(findings.storageKeys).map(s => `- \`${s}\``).join('\n') || '- None found'}
`;

const reportPath = path.join(OUTPUT_DIR, 'ANALYSIS_SUMMARY.md');
fs.writeFileSync(reportPath, analysisReport, 'utf8');
console.log(`\n[+] Analysis summary written to: ${reportPath}`);
console.log('\n=== Deobfuscation Complete! ===');
