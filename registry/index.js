#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { fileURLToPath } from 'node:url';

const REGISTRY_URL =
  'https://raw.githubusercontent.com/MohsenDastaran/uni-kit/main/registry/components.json';
const RAW_REPO_BASE = 'https://raw.githubusercontent.com/MohsenDastaran/uni-kit/main';

const here = path.dirname(fileURLToPath(import.meta.url));
const localRegistry = path.resolve(here, 'components.json');
const localRoot = path.resolve(here, '..');

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume();
        resolve(fetchBuffer(response.headers.location));
        return;
      }
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`HTTP ${response.statusCode} for ${url}`));
        return;
      }
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
    });
    request.on('error', reject);
  });
}

async function loadRegistry() {
  if (process.env.UNI_KIT_REGISTRY) {
    const given = process.env.UNI_KIT_REGISTRY;
    if (given.startsWith('http://') || given.startsWith('https://')) {
      return JSON.parse((await fetchBuffer(given)).toString('utf8'));
    }
    return JSON.parse(fs.readFileSync(given, 'utf8'));
  }
  if (fs.existsSync(localRegistry)) {
    return JSON.parse(fs.readFileSync(localRegistry, 'utf8'));
  }
  return JSON.parse((await fetchBuffer(REGISTRY_URL)).toString('utf8'));
}

async function placeFile(item, destination) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const root = process.env.UNI_KIT_ROOT;
  if (root) {
    fs.copyFileSync(path.join(root, item.src), destination);
    return;
  }
  if (fs.existsSync(localRegistry)) {
    fs.copyFileSync(path.join(localRoot, item.src), destination);
    return;
  }
  const base = process.env.UNI_KIT_RAW ?? RAW_REPO_BASE;
  fs.writeFileSync(destination, await fetchBuffer(`${base}/${item.src}`));
}

function ensureModule(modFile, moduleName) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(moduleName)) {
    throw new Error(`Invalid module name "${moduleName}"`);
  }
  const line = `pub mod ${moduleName};`;
  fs.mkdirSync(path.dirname(modFile), { recursive: true });
  const text = fs.existsSync(modFile) ? fs.readFileSync(modFile, 'utf8') : '';
  const already = new RegExp(`^\\s*(pub\\s+)?mod\\s+${moduleName}\\s*;`, 'm').test(text);
  if (already) return false;
  const next = text.length === 0 || text.endsWith('\n') ? `${text}${line}\n` : `${text}\n${line}\n`;
  fs.writeFileSync(modFile, next);
  return true;
}

function usage() {
  console.log('Usage: uni-kit add <framework> <component> [--dir <path>]');
  console.log('Examples:');
  console.log('  npx uni-kit add slint alert-dialog');
  console.log('  npx uni-kit add egui alert-dialog');
  console.log('  npx uni-kit add gpui button');
  console.log('  npx uni-kit add quickgui button');
}

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === '--help' || args[0] === '-h' || args.length === 0) {
    usage();
    process.exit(args.length === 0 ? 1 : 0);
  }

  const command = args[0];
  const framework = args[1];
  const component = args[2];
  const dirFlag = args.indexOf('--dir');
  const dirOverride = dirFlag === -1 ? undefined : args[dirFlag + 1];

  if (command !== 'add' || !framework || !component || (dirFlag !== -1 && !dirOverride)) {
    usage();
    process.exit(1);
  }

  const registry = await loadRegistry();
  const frameworkConfig = registry[framework];
  if (!frameworkConfig) {
    console.error(`Framework "${framework}" is not in the registry.`);
    process.exit(1);
  }

  const files = frameworkConfig.components?.[component];
  if (!files || files.length === 0) {
    console.error(`Component "${component}" for ${framework} is not in the registry yet.`);
    process.exit(1);
  }

  const baseTargetDir = dirOverride ?? frameworkConfig.default_target_dir;
  if (!baseTargetDir) {
    console.error(`Framework "${framework}" has no default_target_dir.`);
    process.exit(1);
  }

  console.log(`Installing ${component} for ${framework}...`);
  const modules = new Set();
  for (const item of files) {
    if (item.target.includes('..') || path.isAbsolute(item.target)) {
      throw new Error(`Refusing to write outside the target directory: ${item.target}`);
    }
    const destination = path.join(process.cwd(), baseTargetDir, item.target);
    await placeFile(item, destination);
    console.log(`  ${path.join(baseTargetDir, item.target)}`);
    if (item.module) modules.add(item.module);
  }

  if (modules.size > 0) {
    const modFile = path.resolve(process.cwd(), frameworkConfig.mod_file ?? path.join(baseTargetDir, 'mod.rs'));
    for (const moduleName of modules) {
      const added = ensureModule(modFile, moduleName);
      if (added) console.log(`  ${path.relative(process.cwd(), modFile)} += pub mod ${moduleName};`);
    }
  }

  console.log(`Installed ${component} into ${baseTargetDir}/`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
