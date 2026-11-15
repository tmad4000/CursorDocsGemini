import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { appInfo } from './build-info.mjs';
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const info = appInfo(pkg.version);
writeFileSync(new URL('../public/version.json', import.meta.url), JSON.stringify(info) + '\n');
execFileSync(process.execPath, ['node_modules/next/dist/bin/next', 'build'], { stdio: 'inherit', env: { ...process.env, NEXT_PUBLIC_APP_BUILD_INFO: JSON.stringify(info) } });
