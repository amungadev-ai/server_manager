import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const compiler = fileURLToPath(
  new URL('../node_modules/typescript/bin/tsc', import.meta.url),
);
for (const project of ['tsconfig.json', 'tsconfig.esm.json']) {
  execFileSync(process.execPath, [compiler, '-p', project], {
    stdio: 'inherit',
  });
}
mkdirSync('dist/esm', { recursive: true });
writeFileSync('dist/esm/package.json', '{"type":"module"}\n');
