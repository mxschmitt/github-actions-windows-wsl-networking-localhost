// @ts-check
import http from 'http'
import { exec } from 'child_process';

const DISTRIBUTION = 'reproduction'
const SERVER_PORT = 8889

console.log('=== WSL Networking Issue Reproduction ===');

const distributions = (await execAsync('wsl --list --quiet', { encoding: 'utf16le' }))
  .stdout
  .split(/\r?\n/)
  .filter(d => d.trim());

if (!distributions.includes(DISTRIBUTION)) {
  console.log(`Creating WSL distribution '${DISTRIBUTION}'...`);
  await execAsync(`wsl --install -d Ubuntu-24.04 --name ${DISTRIBUTION} --no-launch`);
} else {
  console.log(`WSL distribution '${DISTRIBUTION}' already exists.`);
}

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Hello from Windows via Node.js!');
});

await new Promise((resolve, reject) => {
  server.listen(SERVER_PORT, '0.0.0.0');
  server.on('listening', resolve);
  server.on('error', reject);
});

console.log(`HTTP server listening on 0.0.0.0:${SERVER_PORT}`);

const networkingMode = await execAsync(`wsl -d ${DISTRIBUTION} wslinfo --networking-mode`, { encoding: 'utf-8' });
console.log('Networking mode', networkingMode.stdout.trim());

const natIp = (await execAsync(`wsl -d ${DISTRIBUTION} -- bash -c "ip route show | grep -i default"`, { encoding: 'utf8' })).stdout.split('\n')[0].split(' ')[2];
console.log('NAT gateway IP:', natIp);

const result = await execAsync(`wsl -d ${DISTRIBUTION} -- curl -v -m 50 http://${natIp}:${SERVER_PORT}`);
if (result.stdout.includes("Hello from Windows")) {
  console.log('Curl succeeded, received expected response.');
} else {
  console.error('Curl failed to receive expected response.');
  console.log('Curl result:', result.stdout);
  console.log('Curl stderr:', result.stderr);
}

server.close();

/**
 * @param {string} command 
 * @param {Object} options 
 * @returns {Promise<{ stdout: string, stderr: string }>}
 */
function execAsync(command, options = {}) {
  return new Promise((resolve, reject) => {
    exec(command, options, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve({ stdout: stdout.toString().trim(), stderr: stderr.toString().trim() });
      }
    });
  });
}