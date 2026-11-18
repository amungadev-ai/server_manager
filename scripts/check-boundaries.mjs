import { builtinModules } from 'node:module';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const builtins = new Set(
  builtinModules.map((name) => name.replace(/^node:/, '')),
);
function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory()
      ? walk(path)
      : /\.(ts|svelte|js)$/.test(entry.name)
        ? [path]
        : [];
  });
}
export function checkBoundaries(root) {
  const errors = [];
  for (const area of ['packages/contracts', 'apps/dashboard', 'apps/api']) {
    const manifest = JSON.parse(
      readFileSync(resolve(root, area, 'package.json'), 'utf8'),
    );
    for (const name of Object.keys(manifest.dependencies ?? {})) {
      if (area === 'packages/contracts' && name !== 'zod')
        errors.push(`${area}: nonportable dependency ${name}`);
      if (
        area.startsWith('apps/') &&
        name.startsWith('@cloudlane/') &&
        name !== '@cloudlane/contracts'
      )
        errors.push(`${area}: cross-application dependency ${name}`);
    }
    for (const path of walk(resolve(root, area, 'src'))) {
      const source = readFileSync(path, 'utf8');
      const label = relative(root, path).split(sep).join('/');
      const imports = [
        ...source.matchAll(
          /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s*)['"]([^'"\n]+)['"]/g,
        ),
      ].map((match) => match[1]);
      for (const name of imports) {
        const builtin = name.startsWith('node:') || builtins.has(name);
        const target = name.startsWith('.')
          ? relative(root, resolve(dirname(path), name))
              .split(sep)
              .join('/')
          : name;
        if (
          area === 'packages/contracts' &&
          (builtin ||
            name.startsWith('@nestjs/') ||
            name.startsWith('svelte') ||
            (!name.startsWith('.') && name !== 'zod') ||
            target.startsWith('apps/') ||
            target.startsWith('agent/') ||
            target.startsWith('installer/'))
        )
          errors.push(`${label}: contracts cannot import ${name}`);
        if (
          area === 'apps/dashboard' &&
          (builtin ||
            name.startsWith('@nestjs/') ||
            name === '@cloudlane/contracts/agent' ||
            target.startsWith('apps/api/') ||
            target.startsWith('agent/') ||
            target.startsWith('installer/'))
        )
          errors.push(`${label}: browser cannot import ${name}`);
        if (
          area === 'apps/api' &&
          (target.startsWith('apps/dashboard/') ||
            /^(?:node:)?child_process$/.test(name))
        )
          errors.push(`${label}: API cannot import ${name}`);
      }
      if (
        area === 'apps/api' &&
        /\b(?:execSync|execFileSync|spawnSync|execFile|spawn|eval)\s*\(/.test(
          source,
        )
      )
        errors.push(
          `${label}: direct process/dynamic execution is not permitted`,
        );
    }
  }
  return errors;
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const errors = checkBoundaries(resolve(process.argv[2] ?? '.'));
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exitCode = 1;
  } else console.log('PASS: package and import boundaries');
}
