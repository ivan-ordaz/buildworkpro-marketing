// Resolve the local app's seed password without ever hard-coding it.
// Order: explicit env var, then Doppler (main app dev config).
import { execFileSync } from 'node:child_process';

export function resolvePassword() {
  if (process.env.DEV_SEED_PASSWORD) return process.env.DEV_SEED_PASSWORD;
  try {
    return execFileSync(
      'doppler',
      [
        'secrets',
        'get',
        'DEV_SEED_PASSWORD',
        '--plain',
        '--project',
        'buildworkpro',
        '--config',
        'dev',
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
    ).trim();
  } catch {
    throw new Error(
      'Could not resolve DEV_SEED_PASSWORD. Set it in the environment, or make sure ' +
        '`doppler` is authenticated for project=buildworkpro config=dev.'
    );
  }
}
