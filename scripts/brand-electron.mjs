#!/usr/bin/env node
// Brand the local Electron.app for macOS:
// - rename Electron.app → "Time Tracker.app" (Dock hover uses the folder name)
// - compile Icon Composer .icon → Assets.car (liquid glass / light / dark)
// - patch Info.plist + install Assets.car / .icns into the bundle
import { createRequire } from 'module'
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync
} from 'fs'
import { dirname, join, resolve } from 'path'
import { tmpdir } from 'os'
import { execFileSync, spawnSync } from 'child_process'
import { fileURLToPath } from 'url'

const NAME = 'Time Tracker'
const APP_NAME = `${NAME}.app`
const ICON_ASSET = 'Icon'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const iconSrc = join(root, 'resources/time_tracker.icon')
const assetsCar = join(root, 'resources/Assets.car')
const iconIcns = join(root, 'resources/Icon.icns')
const xcode = '/Applications/Xcode-26.3.0.app/Contents/Developer'

const require = createRequire(import.meta.url)
const electronPkg = dirname(require.resolve('electron/package.json'))
const distDir = join(electronPkg, 'dist')
const pathFile = join(electronPkg, 'path.txt')

function currentAppDir() {
  const relative = existsSync(pathFile) ? readFileSync(pathFile, 'utf8').trim() : ''
  const name = relative.includes('/') ? relative.slice(0, relative.indexOf('/')) : 'Electron.app'
  return join(distDir, name)
}

function targetAppDir() {
  return join(distDir, APP_NAME)
}

function plistPath() {
  return join(targetAppDir(), 'Contents/Info.plist')
}

function resourcesDir() {
  return join(targetAppDir(), 'Contents/Resources')
}

function plistGet(key) {
  return execFileSync('/usr/libexec/PlistBuddy', ['-c', `Print :${key}`, plistPath()], {
    encoding: 'utf8'
  }).trim()
}

function plistSet(key, value) {
  try {
    plistGet(key)
    execFileSync('/usr/libexec/PlistBuddy', ['-c', `Set :${key} ${value}`, plistPath()])
  } catch {
    execFileSync('/usr/libexec/PlistBuddy', ['-c', `Add :${key} string ${value}`, plistPath()])
  }
}

function ensurePlistWritable() {
  const p = plistPath()
  const original = readFileSync(p)
  unlinkSync(p)
  writeFileSync(p, original)
}

function renameBundle() {
  const target = targetAppDir()
  if (existsSync(target)) {
    writeFileSync(pathFile, `${APP_NAME}/Contents/MacOS/Electron`)
    return
  }

  const current = currentAppDir()
  if (!existsSync(current)) {
    throw new Error(`Electron app bundle not found in ${distDir}`)
  }
  renameSync(current, target)
  writeFileSync(pathFile, `${APP_NAME}/Contents/MacOS/Electron`)
  console.log(`[brand-electron] Renamed ${current.split('/').pop()} → ${APP_NAME}`)
}

function needsCompile() {
  if (!existsSync(iconSrc)) throw new Error(`Missing ${iconSrc}`)
  if (!existsSync(assetsCar) || !existsSync(iconIcns)) return true
  const srcMtime = Math.max(
    statSync(join(iconSrc, 'icon.json')).mtimeMs,
    ...['time_tracker_logo.svg']
      .map((f) => join(iconSrc, 'Assets', f))
      .filter(existsSync)
      .map((f) => statSync(f).mtimeMs)
  )
  return srcMtime > statSync(assetsCar).mtimeMs
}

function compileIcon() {
  if (!needsCompile()) {
    console.log('[brand-electron] Assets.car up to date')
    return
  }
  if (!existsSync(join(xcode, 'usr/bin/actool'))) {
    throw new Error('Xcode 26+ with actool required to compile .icon → Assets.car')
  }

  const tmp = mkdtempSync(join(tmpdir(), 'tt-icon-'))
  try {
    const iconPath = join(tmp, 'Icon.icon')
    const out = join(tmp, 'out')
    mkdirSync(out)
    cpSync(iconSrc, iconPath, { recursive: true })

    execFileSync(
      'xcrun',
      [
        'actool',
        iconPath,
        '--compile',
        out,
        '--output-format',
        'human-readable-text',
        '--notices',
        '--warnings',
        '--errors',
        '--output-partial-info-plist',
        join(out, 'assetcatalog_generated_info.plist'),
        '--app-icon',
        ICON_ASSET,
        '--include-all-app-icons',
        '--enable-on-demand-resources',
        'NO',
        '--development-region',
        'en',
        '--target-device',
        'mac',
        '--minimum-deployment-target',
        '26.0',
        '--platform',
        'macosx'
      ],
      { env: { ...process.env, DEVELOPER_DIR: xcode }, stdio: 'inherit' }
    )

    copyFileSync(join(out, 'Assets.car'), assetsCar)
    copyFileSync(join(out, 'Icon.icns'), iconIcns)
    console.log('[brand-electron] Compiled time_tracker.icon → Assets.car')
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
}

function installBranding() {
  ensurePlistWritable()
  copyFileSync(assetsCar, join(resourcesDir(), 'Assets.car'))
  copyFileSync(iconIcns, join(resourcesDir(), 'electron.icns'))
  plistSet('CFBundleName', NAME)
  plistSet('CFBundleDisplayName', NAME)
  plistSet('CFBundleIconName', ICON_ASSET)
  plistSet('CFBundleIconFile', 'electron.icns')

  const lsregister =
    '/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister'
  if (existsSync(lsregister)) {
    spawnSync(lsregister, ['-f', targetAppDir()], { stdio: 'ignore' })
  }
  console.log(`[brand-electron] ${APP_NAME} → name "${NAME}", liquid-glass icon ready`)
}

compileIcon()
renameBundle()
installBranding()
