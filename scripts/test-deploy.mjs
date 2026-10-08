import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

// An isolated local container/volume; never starts the deployment's real service.
const suffix = randomUUID().slice(0, 8), name = `iahcarus-test-${suffix}`, volume = `${name}-accounts`;
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const image = process.env.DEPLOY_TEST_IMAGE || 'iahcarus-deploy:test';
const origin = 'https://your-game-domain.example';
const testPassword = 'Synthetic-Container-Test-Only';
const safeMessage = (value) => String(value).replaceAll(testPassword, '[synthetic test credential]');
function diagnostic() {
  try {
    console.error('Test container state:', docker('inspect', name, '--format', '{{json .State}}'));
    const logs = spawnSync('docker', ['logs', '--tail', '80', name], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    console.error('Test container startup logs:\n' + safeMessage((logs.stdout || '') + (logs.stderr || '')));
  } catch { console.error('Test container diagnostics unavailable'); }
}
try {
  docker('volume', 'create', volume);
  docker('run', '--detach', '--name', name, '--publish', '127.0.0.1::3000',
    '--mount', `type=volume,source=${volume},target=/app/data`,
    '--env', `ACCOUNT_PUBLIC_ORIGIN=${origin}`, image);
  // Run requests inside the test container: this also supports a remote Docker daemon.
  const request = (body) => docker('exec', name, 'node', '-e', body);
  const ready = `fetch('http://127.0.0.1:3000/health').then(async r=>{if(!r.ok||!(await r.json()).ok)process.exit(1)}).catch(()=>process.exit(1))`;
  async function waitHealthy() {
    for (let i = 0; i < 30; i++) {
      try { request(ready); return; }
      catch {
        const running = docker('inspect', name, '--format', '{{.State.Running}}');
        assert.equal(running, 'true', 'the built image exited before serving a healthy game');
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    assert.fail('the built image did not become healthy within the startup timeout');
  }
  await waitHealthy();
  const permissions = request(`const fs=require('node:fs'),assert=require('node:assert/strict');assert.notEqual(process.getuid(),0);for(const path of ['/app/server/index.mjs','/app/server/accounts.mjs','/app/shared/cosmetics.js','/app/dist/index.html','/app/package.json']){assert.equal(fs.statSync(path).uid,0);fs.accessSync(path,fs.constants.R_OK);assert.throws(()=>fs.accessSync(path,fs.constants.W_OK));}assert.equal(fs.statSync('/app/data').uid,process.getuid());assert.equal(fs.statSync('/app/data').mode&0o777,0o700);fs.accessSync('/app/data',fs.constants.W_OK);console.log('protected')`);
  assert.equal(permissions, 'protected', 'runtime code stays root-owned/readable while only account storage is writable');
  const character = { name: 'Deploy Tester', silhouette: 'sentinel', crest: 'wing', accent: 'cyan' };
  const payload = { username: 'Deploy_Tester', password: testPassword, character };
  const response = JSON.parse(request(`(async()=>{const r=await fetch('http://127.0.0.1:3000/api/account/register',{method:'POST',headers:{'Content-Type':'application/json',Origin:${JSON.stringify(origin)}},body:JSON.stringify(${JSON.stringify(payload)})}); const data=await r.json();console.log(JSON.stringify({status:r.status,name:data.user?.character?.name,secure:r.headers.get('set-cookie')?.includes('Secure'),httpOnly:r.headers.get('set-cookie')?.includes('HttpOnly')}));})().catch(()=>process.exit(1))`));
  assert.deepEqual(response, { status: 201, name: character.name, secure: true, httpOnly: true });
  const page = request(`fetch('http://127.0.0.1:3000/').then(async r=>{const text=await r.text();if(!r.ok||!text.includes('type="module"'))process.exit(1);console.log('ready')}).catch(()=>process.exit(1))`);
  assert.equal(page, 'ready');
  // Recreate, rather than only restart: persistence must live in the volume.
  docker('rm', '--force', name);
  docker('run', '--detach', '--name', name, '--publish', '127.0.0.1::3000',
    '--mount', `type=volume,source=${volume},target=/app/data`, '--env', `ACCOUNT_PUBLIC_ORIGIN=${origin}`, image);
  await waitHealthy();
  const login = JSON.parse(request(`(async()=>{const r=await fetch('http://127.0.0.1:3000/api/account/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:${JSON.stringify(origin)}},body:JSON.stringify(${JSON.stringify({ username: payload.username, password: payload.password })})});const data=await r.json();console.log(JSON.stringify({status:r.status,name:data.user?.character?.name}));})().catch(()=>process.exit(1))`));
  assert.deepEqual(login, { status: 200, name: character.name });
  console.log('PASS: Docker image serves the game/accounts with secure cookies; account data survives container recreation in a separate test volume');
} catch (error) {
  diagnostic();
  throw new Error(safeMessage(error instanceof Error ? error.message : error));
} finally {
  try { docker('rm', '--force', name); } catch {}
  try { docker('volume', 'rm', volume); } catch {}
}
