#!/usr/bin/env node
import { existsSync } from 'node:fs';
import path from 'node:path';

import { Sindie } from './sindie.js'
import { SindieConfig } from './sindie-config.js';

const args = new Set(process.argv);
const config = new SindieConfig();

for (const configFile of [
  '.sindie.js',
  '.sindie.config.js',
]) {
  if (existsSync(configFile)) {
    try {
      const module = await import(path.resolve(process.cwd(), configFile));
      if (typeof module.default === "function") {
        config.addPlugin(module.default);
      }
      break;
    } catch (err) {
      console.error('Error reading config: ', err);
      process.exit(1);
    }
  }
}

function help() {
  console.info(`Sindie - Simple Static Side Instrument 👸`);
  console.info();
  console.info('command line args:')
  console.info(`sindie build - build site`);
  console.info(`sindie watch - watch mode`);
  console.info(`sindie dev - dev server mode`);
  console.info(`sindie version - version information`);
}

async function run() {
  const sindie = new Sindie(config);
  try {
    if (args.has('--dry')) {
      sindie.dryMode = true;
    }

    if (args.has('watch')) {
      await sindie.watch();
      return;
    }
    
    if (args.has('dev')) {
      await sindie.serve();
      return;
    }
    
    if (args.has('build')) {
      await sindie.build();
      return;
    }
    help();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
