#!/usr/bin/env node
// Remove a scene's marked load waits from its recording (see lib/cuts.mjs).
//   node marketing-capture/apply-cuts.mjs <scene>
// run.mjs already does this after every take; use this to re-cut by hand.
import { applyCuts } from './lib/cuts.mjs';

const name = process.argv[2];
if (!name) {
  console.error('Usage: node marketing-capture/apply-cuts.mjs <scene>');
  process.exit(1);
}
await applyCuts(name);
