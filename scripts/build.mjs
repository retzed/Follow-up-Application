import { mkdir, readFile, writeFile } from 'node:fs/promises';

const source = await readFile('index.html', 'utf8');
const outputDirectory = 'dist';
const runtimeConfig = {
  cognito: { userPoolId: '', userPoolClientId: '', teamUserAttribute: '', identityMap: {} },
  localAuth: { enabled: true },
  dataMode: 'builtin',
  apiBaseUrl: ''
};

const configBlock = /<script id="team-follow-up-runtime-config">[\\s\\S]*?<\\/script>/;
if (!configBlock.test(source)) {
  throw new Error('index.html is missing the Team Follow-Up runtime configuration block.');
}

const serialized = JSON.stringify(runtimeConfig, null, 2).replaceAll('<', '\\u003c');
const replacement = '<script id="team-follow-up-runtime-config">\\n' +
  '/* This build intentionally uses the browser-local demo adapter. */\\n' +
  'window.TEAM_FOLLOW_UP_CONFIG = Object.freeze(' + serialized + ');\\n' +
  '</script>';
const output = source.replace(configBlock, replacement);

await mkdir(outputDirectory, { recursive: true });
await writeFile(outputDirectory + '/index.html', output, 'utf8');
await writeFile(outputDirectory + '/.nojekyll', '', 'utf8');
console.log('Built the local Team Follow-Up demo to dist/ (browser-local data, demo sign-in enabled).');
