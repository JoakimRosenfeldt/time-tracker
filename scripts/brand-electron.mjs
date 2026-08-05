#!/usr/bin/env node
// ponytail: macOS Dock/menu name comes from Electron.app Info.plist, not app.setName()
import { createRequire } from 'module'
import { readFileSync, unlinkSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { execFileSync } from 'child_process'

const NAME = 'Time Tracker'
const require = createRequire(import.meta.url)
const electronBin = require('electron')
const plistPath = resolve(electronBin, '../../Info.plist')

function get(key) {
  return execFileSync('/usr/libexec/PlistBuddy', ['-c', `Print :${key}`, plistPath], {
    encoding: 'utf8'
  }).trim()
}

function set(key, value) {
  try {
    execFileSync('/usr/libexec/PlistBuddy', ['-c', `Set :${key} ${value}`, plistPath])
  } catch {
    execFileSync('/usr/libexec/PlistBuddy', ['-c', `Add :${key} string ${value}`, plistPath])
  }
}

try {
  if (get('CFBundleName') === NAME && get('CFBundleDisplayName') === NAME) process.exit(0)
} catch {
  // CFBundleDisplayName may be missing
}

// break hardlinks into the electron cache store
const original = readFileSync(plistPath)
unlinkSync(plistPath)
writeFileSync(plistPath, original)

set('CFBundleName', NAME)
set('CFBundleDisplayName', NAME)
console.log(`[brand-electron] Dock name → "${NAME}"`)
