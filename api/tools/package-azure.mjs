// Stage one complete deployment unit. No Azure calls, credentials or side effects.
// Previously deploying api/azure alone omitted imports under api/src entirely.
import { cp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
const root = new URL('../', import.meta.url);
const output = resolve(process.argv[2] || '');
if (!process.argv[2]) throw new Error('Pass a new empty output directory');
await mkdir(output); // Refuse to overwrite an existing directory.
for (const name of ['src', 'azure']) await cp(new URL(name, root), join(output, name), { recursive: true, filter: source => !source.split('/').includes('node_modules') });
for (const name of ['package.json', 'package-lock.json']) await cp(new URL(name, root), join(output, name));
await writeFile(join(output, 'host.json'), await readFile(new URL('azure/host.json', root)));
console.log('Staged Azure backend; no deployment performed.');
