import * as fs from 'fs'
import * as path from 'path'
import type { ScanItem, ScanProgress, ScanSubCategory } from './types'
import { SCAN_CATEGORIES } from './categories'

const HOME = process.env.USERPROFILE || ''
const APPDATA = process.env.APPDATA || ''
const LOCALAPPDATA = process.env.LOCALAPPDATA || ''
const PROGRAMDATA = process.env.PROGRAMDATA || 'C:\\ProgramData'
const WINDIR = process.env.WINDIR || 'C:\\Windows'
const PROGRAMFILES = process.env.ProgramFiles || 'C:\\Program Files'
const PROGRAMFILES_X86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)'

let progressCallback: ((progress: ScanProgress) => void) | null = null
let isCancelled = false

export function setProgressCallback(cb: (progress: ScanProgress) => void): void {
  progressCallback = cb
}

export function cancelScan(): void {
  isCancelled = true
}

function reportProgress(current: string, percent: number, scanned: number, found: number): void {
  if (progressCallback) {
    progressCallback({ current, percent, scanned, found })
  }
}

function safeReaddir(dirPath: string): string[] {
  try {
    return fs.readdirSync(dirPath)
  } catch {
    return []
  }
}

function safeStat(filePath: string): fs.Stats | null {
  try {
    return fs.statSync(filePath)
  } catch {
    return null
  }
}

function getDirectorySize(dirPath: string): number {
  if (!fs.existsSync(dirPath)) return 0
  try {
    const stat = safeStat(dirPath)
    if (!stat) return 0
    if (!stat.isDirectory()) return stat.size
    let size = 0
    const entries = safeReaddir(dirPath)
    for (const entry of entries) {
      try {
        const full = path.join(dirPath, entry)
        const s = safeStat(full)
        if (s) {
          if (s.isDirectory()) {
            size += getDirectorySize(full)
          } else {
            size += s.size
          }
        }
      } catch {
        continue
      }
    }
    return size
  } catch {
    return 0
  }
}

function pathNeedsElevation(filePath: string): boolean {
  const lower = filePath.toLowerCase()
  return (
    lower.startsWith(WINDIR.toLowerCase()) ||
    lower.startsWith(PROGRAMFILES.toLowerCase()) ||
    lower.startsWith(PROGRAMFILES_X86.toLowerCase()) ||
    lower.startsWith(PROGRAMDATA.toLowerCase())
  )
}

function createItem(
  filePath: string,
  stat: fs.Stats,
  reason: string,
  category: string,
  subCategory: string
): ScanItem {
  return {
    path: filePath,
    size: stat.isDirectory() ? getDirectorySize(filePath) : stat.size,
    lastModified: stat.mtime,
    reason,
    needsElevation: pathNeedsElevation(filePath),
    category,
    subCategory
  }
}

function scanDirectoryForFiles(
  dirPath: string,
  extensions: string[],
  category: string,
  subCategory: string,
  reason: string,
  maxDepth: number = 5,
  currentDepth: number = 0,
  scanned: { count: number },
  found: { count: number }
): ScanItem[] {
  if (isCancelled) return []
  const results: ScanItem[] = []
  if (!fs.existsSync(dirPath) || currentDepth > maxDepth) return results

  const entries = safeReaddir(dirPath)
  for (const entry of entries) {
    if (isCancelled) break
    try {
      const full = path.join(dirPath, entry)
      const stat = safeStat(full)
      if (!stat) continue

      scanned.count++
      if (scanned.count % 100 === 0) {
        reportProgress(full, 0, scanned.count, found.count)
      }

      if (stat.isDirectory()) {
        results.push(
          ...scanDirectoryForFiles(
            full,
            extensions,
            category,
            subCategory,
            reason,
            maxDepth,
            currentDepth + 1,
            scanned,
            found
          )
        )
      } else {
        const ext = path.extname(entry).toLowerCase()
        if (extensions.length === 0 || extensions.includes(ext)) {
          results.push(createItem(full, stat, reason, category, subCategory))
          found.count++
        }
      }
    } catch {
      continue
    }
  }
  return results
}

function scanDirectoryPatterns(
  basePath: string,
  patterns: string[],
  category: string,
  subCategory: string,
  reason: string,
  matchDirectories: boolean = true,
  scanned: { count: number },
  found: { count: number }
): ScanItem[] {
  if (isCancelled) return []
  const results: ScanItem[] = []
  if (!fs.existsSync(basePath)) return results

  const entries = safeReaddir(basePath)
  for (const entry of entries) {
    if (isCancelled) break
    try {
      const full = path.join(basePath, entry)
      const stat = safeStat(full)
      if (!stat) continue

      scanned.count++
      if (scanned.count % 100 === 0) {
        reportProgress(full, 0, scanned.count, found.count)
      }

      const lowerEntry = entry.toLowerCase()
      const matches = patterns.some((p) => lowerEntry.includes(p.toLowerCase()))

      if (matches) {
        if (matchDirectories && stat.isDirectory()) {
          results.push(createItem(full, stat, reason, category, subCategory))
          found.count++
        } else if (!stat.isDirectory()) {
          results.push(createItem(full, stat, reason, category, subCategory))
          found.count++
        }
      } else if (stat.isDirectory()) {
        results.push(
          ...scanDirectoryPatterns(full, patterns, category, subCategory, reason, matchDirectories, scanned, found)
        )
      }
    } catch {
      continue
    }
  }
  return results
}

function addExistingDirectory(
  dirPath: string,
  category: string,
  subCategory: string,
  reason: string
): ScanItem[] {
  if (fs.existsSync(dirPath)) {
    const stat = safeStat(dirPath)
    if (stat) {
      return [createItem(dirPath, stat, reason, category, subCategory)]
    }
  }
  return []
}

interface ScanTask {
  category: string
  subCategory: string
  scanFn: () => ScanItem[]
  description: string
}

function buildScanTasks(): ScanTask[] {
  const scanned = { count: 0 }
  const found = { count: 0 }

  return [
    {
      category: 'system_temp',
      subCategory: 'windows_temp',
      description: '扫描Windows临时目录...',
      scanFn: () => {
        const tempDir = path.join(WINDIR, 'Temp')
        const items: ScanItem[] = []
        if (fs.existsSync(tempDir)) {
          const entries = safeReaddir(tempDir)
          for (const entry of entries) {
            if (isCancelled) break
            try {
              const full = path.join(tempDir, entry)
              const stat = safeStat(full)
              if (stat) {
                items.push(createItem(full, stat, 'Windows系统临时文件', 'system_temp', 'windows_temp'))
                found.count++
              }
            } catch {
              continue
            }
            scanned.count++
          }
        }
        return items
      }
    },
    {
      category: 'system_temp',
      subCategory: 'user_temp',
      description: '扫描用户临时目录...',
      scanFn: () => {
        const tempDir = process.env.TEMP || process.env.TMP || path.join(LOCALAPPDATA, 'Temp')
        const items: ScanItem[] = []
        if (fs.existsSync(tempDir)) {
          const entries = safeReaddir(tempDir)
          for (const entry of entries) {
            if (isCancelled) break
            try {
              const full = path.join(tempDir, entry)
              const stat = safeStat(full)
              if (stat) {
                items.push(createItem(full, stat, '用户临时文件', 'system_temp', 'user_temp'))
                found.count++
              }
            } catch {
              continue
            }
            scanned.count++
          }
        }
        return items
      }
    },
    {
      category: 'system_temp',
      subCategory: 'prefetch',
      description: '扫描预读取文件...',
      scanFn: () => {
        const prefetchDir = path.join(WINDIR, 'Prefetch')
        return scanDirectoryForFiles(
          prefetchDir,
          ['.pf'],
          'system_temp',
          'prefetch',
          'Windows预读取缓存文件',
          1,
          0,
          scanned,
          found
        )
      }
    },
    {
      category: 'system_temp',
      subCategory: 'thumbnails',
      description: '扫描缩略图缓存...',
      scanFn: () => {
        const thumbDir = path.join(LOCALAPPDATA, 'Microsoft', 'Windows', 'Explorer')
        return scanDirectoryForFiles(
          thumbDir,
          ['.db'],
          'system_temp',
          'thumbnails',
          '资源管理器缩略图缓存',
          2,
          0,
          scanned,
          found
        )
      }
    },
    {
      category: 'system_temp',
      subCategory: 'memory_dump',
      description: '扫描内存转储文件...',
      scanFn: () => {
        const items: ScanItem[] = []
        const dumpPaths = [
          path.join(WINDIR, 'MEMORY.DMP'),
          path.join(WINDIR, 'Minidump'),
          path.join(LOCALAPPDATA, 'CrashDumps')
        ]
        for (const p of dumpPaths) {
          items.push(...addExistingDirectory(p, 'system_temp', 'memory_dump', '内存转储/崩溃转储文件'))
        }
        found.count += items.length
        return items
      }
    },
    {
      category: 'system_temp',
      subCategory: 'system_logs',
      description: '扫描系统日志文件...',
      scanFn: () => {
        const logPaths = [
          path.join(WINDIR, 'Logs'),
          path.join(WINDIR, 'System32', 'LogFiles'),
          path.join(WINDIR, 'Panther'),
          path.join(PROGRAMDATA, 'Microsoft', 'Windows', 'WER')
        ]
        let items: ScanItem[] = []
        for (const p of logPaths) {
          items = items.concat(
            scanDirectoryForFiles(p, ['.log', '.etl', '.evt', '.evtx'], 'system_temp', 'system_logs', '系统日志文件', 4, 0, scanned, found)
          )
        }
        return items
      }
    },
    {
      category: 'system_temp',
      subCategory: 'winsxs_backup',
      description: '扫描WinSxS备份...',
      scanFn: () => {
        const winsxsDir = path.join(WINDIR, 'WinSxS')
        return scanDirectoryPatterns(
          winsxsDir,
          ['backup', 'temp'],
          'system_temp',
          'winsxs_backup',
          'WinSxS组件备份文件',
          true,
          scanned,
          found
        )
      }
    },
    {
      category: 'appdata_cache',
      subCategory: 'appdata_local_temp',
      description: '扫描AppData本地临时文件...',
      scanFn: () => {
        const localDirs = [
          path.join(LOCALAPPDATA, 'Temp'),
          path.join(LOCALAPPDATA, 'CrashDumps')
        ]
        let items: ScanItem[] = []
        for (const d of localDirs) {
          if (fs.existsSync(d)) {
            const entries = safeReaddir(d)
            for (const entry of entries) {
              if (isCancelled) break
              try {
                const full = path.join(d, entry)
                const stat = safeStat(full)
                if (stat) {
                  items.push(createItem(full, stat, 'AppData本地临时文件', 'appdata_cache', 'appdata_local_temp'))
                  found.count++
                }
              } catch {
                continue
              }
              scanned.count++
            }
          }
        }
        return items
      }
    },
    {
      category: 'appdata_cache',
      subCategory: 'appdata_roaming_cache',
      description: '扫描漫游应用缓存...',
      scanFn: () => {
        const cachePatterns = ['cache', 'caches', 'temp']
        return scanDirectoryPatterns(
          APPDATA,
          cachePatterns,
          'appdata_cache',
          'appdata_roaming_cache',
          '漫游应用程序缓存',
          true,
          scanned,
          found
        )
      }
    },
    {
      category: 'appdata_cache',
      subCategory: 'crash_reports',
      description: '扫描崩溃报告...',
      scanFn: () => {
        const crashDirs = [
          path.join(APPDATA, 'Microsoft', 'Windows', 'WER', 'ReportArchive'),
          path.join(APPDATA, 'Microsoft', 'Windows', 'WER', 'ReportQueue'),
          path.join(LOCALAPPDATA, 'Microsoft', 'Windows', 'WER', 'ReportArchive'),
          path.join(LOCALAPPDATA, 'Microsoft', 'Windows', 'WER', 'ReportQueue')
        ]
        let items: ScanItem[] = []
        for (const d of crashDirs) {
          items.push(...addExistingDirectory(d, 'appdata_cache', 'crash_reports', '应用程序崩溃报告'))
        }
        found.count += items.length
        return items
      }
    },
    {
      category: 'appdata_cache',
      subCategory: 'browser_cache',
      description: '扫描浏览器缓存...',
      scanFn: () => {
        const browserPaths = [
          { path: path.join(LOCALAPPDATA, 'Google', 'Chrome', 'User Data'), name: 'Chrome' },
          { path: path.join(LOCALAPPDATA, 'Microsoft', 'Edge', 'User Data'), name: 'Edge' },
          { path: path.join(APPDATA, 'Mozilla', 'Firefox', 'Profiles'), name: 'Firefox' },
          { path: path.join(APPDATA, 'Opera Software', 'Opera Stable'), name: 'Opera' },
          { path: path.join(LOCALAPPDATA, 'BraveSoftware', 'Brave-Browser', 'User Data'), name: 'Brave' }
        ]
        let items: ScanItem[] = []
        const cacheDirNames = ['Cache', 'Code Cache', 'GPUCache', 'Service Worker', 'Media Cache', 'ShaderCache']
        for (const browser of browserPaths) {
          if (fs.existsSync(browser.path)) {
            items.push(
              ...scanDirectoryPatterns(
                browser.path,
                cacheDirNames,
                'appdata_cache',
                'browser_cache',
                `${browser.name}浏览器缓存`,
                true,
                scanned,
                found
              )
            )
          }
        }
        return items
      }
    },
    {
      category: 'appdata_cache',
      subCategory: 'electron_cache',
      description: '扫描Electron应用缓存...',
      scanFn: () => {
        const electronDirs = safeReaddir(APPDATA)
        let items: ScanItem[] = []
        for (const dir of electronDirs) {
          if (isCancelled) break
          const electronCache = path.join(APPDATA, dir, 'Cache')
          const electronCodeCache = path.join(APPDATA, dir, 'Code Cache')
          const electronGPUCache = path.join(APPDATA, dir, 'GPUCache')
          for (const cachePath of [electronCache, electronCodeCache, electronGPUCache]) {
            items.push(...addExistingDirectory(cachePath, 'appdata_cache', 'electron_cache', 'Electron应用缓存'))
          }
        }
        const localElectronDirs = safeReaddir(LOCALAPPDATA)
        for (const dir of localElectronDirs) {
          if (isCancelled) break
          const electronCache = path.join(LOCALAPPDATA, dir, 'Cache')
          const electronCodeCache = path.join(LOCALAPPDATA, dir, 'Code Cache')
          const electronGPUCache = path.join(LOCALAPPDATA, dir, 'GPUCache')
          for (const cachePath of [electronCache, electronCodeCache, electronGPUCache]) {
            items.push(...addExistingDirectory(cachePath, 'appdata_cache', 'electron_cache', 'Electron应用缓存'))
          }
        }
        found.count += items.length
        return items
      }
    },
    {
      category: 'appdata_cache',
      subCategory: 'media_cache',
      description: '扫描媒体软件缓存...',
      scanFn: () => {
        const mediaPaths = [
          path.join(APPDATA, 'Spotify', 'Storage'),
          path.join(LOCALAPPDATA, 'Spotify', 'Storage'),
          path.join(APPDATA, 'vlc', 'cache'),
          path.join(LOCALAPPDATA, 'PotPlayerMini64', 'Cache'),
          path.join(APPDATA, 'NetEase', 'CloudMusic', 'Cache')
        ]
        let items: ScanItem[] = []
        for (const p of mediaPaths) {
          items.push(...addExistingDirectory(p, 'appdata_cache', 'media_cache', '媒体软件缓存'))
        }
        found.count += items.length
        return items
      }
    },
    {
      category: 'package_manager',
      subCategory: 'npm_cache',
      description: '扫描NPM缓存...',
      scanFn: () => {
        const npmCache = path.join(APPDATA, 'npm-cache')
        const npmCache2 = path.join(LOCALAPPDATA, 'npm-cache')
        let items = addExistingDirectory(npmCache, 'package_manager', 'npm_cache', 'NPM包缓存')
        items = items.concat(addExistingDirectory(npmCache2, 'package_manager', 'npm_cache', 'NPM包缓存'))
        found.count += items.length
        return items
      }
    },
    {
      category: 'package_manager',
      subCategory: 'yarn_cache',
      description: '扫描Yarn缓存...',
      scanFn: () => {
        const yarnCache = path.join(LOCALAPPDATA, 'Yarn', 'Cache')
        const yarnCache2 = path.join(APPDATA, 'Yarn', 'Cache')
        let items = addExistingDirectory(yarnCache, 'package_manager', 'yarn_cache', 'Yarn包缓存')
        items = items.concat(addExistingDirectory(yarnCache2, 'package_manager', 'yarn_cache', 'Yarn包缓存'))
        found.count += items.length
        return items
      }
    },
    {
      category: 'package_manager',
      subCategory: 'pip_cache',
      description: '扫描Pip缓存...',
      scanFn: () => {
        const pipCache = path.join(LOCALAPPDATA, 'pip', 'Cache')
        const pipCache2 = path.join(HOME, 'pip', 'cache')
        let items = addExistingDirectory(pipCache, 'package_manager', 'pip_cache', 'Python Pip缓存')
        items = items.concat(addExistingDirectory(pipCache2, 'package_manager', 'pip_cache', 'Python Pip缓存'))
        found.count += items.length
        return items
      }
    },
    {
      category: 'package_manager',
      subCategory: 'nuget_cache',
      description: '扫描NuGet缓存...',
      scanFn: () => {
        const nugetCache = path.join(LOCALAPPDATA, 'NuGet', 'v3-cache')
        const nugetPackages = path.join(HOME, '.nuget', 'packages')
        const nugetPlugins = path.join(APPDATA, 'NuGet', 'plugins-cache')
        let items = addExistingDirectory(nugetCache, 'package_manager', 'nuget_cache', 'NuGet包缓存')
        items = items.concat(addExistingDirectory(nugetPackages, 'package_manager', 'nuget_cache', 'NuGet全局包缓存'))
        items = items.concat(addExistingDirectory(nugetPlugins, 'package_manager', 'nuget_cache', 'NuGet插件缓存'))
        found.count += items.length
        return items
      }
    },
    {
      category: 'package_manager',
      subCategory: 'maven_cache',
      description: '扫描Maven缓存...',
      scanFn: () => {
        const mavenRepo = path.join(HOME, '.m2', 'repository')
        const items = addExistingDirectory(mavenRepo, 'package_manager', 'maven_cache', 'Maven本地仓库缓存')
        found.count += items.length
        return items
      }
    },
    {
      category: 'package_manager',
      subCategory: 'gradle_cache',
      description: '扫描Gradle缓存...',
      scanFn: () => {
        const gradleCache = path.join(HOME, '.gradle', 'caches')
        const gradleWrapper = path.join(HOME, '.gradle', 'wrapper', 'dists')
        const gradleDaemon = path.join(HOME, '.gradle', 'daemon')
        let items = addExistingDirectory(gradleCache, 'package_manager', 'gradle_cache', 'Gradle构建缓存')
        items = items.concat(addExistingDirectory(gradleWrapper, 'package_manager', 'gradle_cache', 'Gradle Wrapper缓存'))
        items = items.concat(addExistingDirectory(gradleDaemon, 'package_manager', 'gradle_cache', 'Gradle守护进程日志'))
        found.count += items.length
        return items
      }
    },
    {
      category: 'package_manager',
      subCategory: 'cargo_cache',
      description: '扫描Cargo缓存...',
      scanFn: () => {
        const cargoRegistry = path.join(HOME, '.cargo', 'registry')
        const cargoGit = path.join(HOME, '.cargo', 'git')
        let items = addExistingDirectory(cargoRegistry, 'package_manager', 'cargo_cache', 'Cargo包注册表缓存')
        items = items.concat(addExistingDirectory(cargoGit, 'package_manager', 'cargo_cache', 'Cargo Git依赖缓存'))
        found.count += items.length
        return items
      }
    },
    {
      category: 'package_manager',
      subCategory: 'go_cache',
      description: '扫描Go模块缓存...',
      scanFn: () => {
        const goPath = process.env.GOPATH || path.join(HOME, 'go')
        const goModCache = path.join(goPath, 'pkg', 'mod')
        const goBuildCache = path.join(LOCALAPPDATA, 'go-build')
        let items = addExistingDirectory(goModCache, 'package_manager', 'go_cache', 'Go模块缓存')
        items = items.concat(addExistingDirectory(goBuildCache, 'package_manager', 'go_cache', 'Go构建缓存'))
        found.count += items.length
        return items
      }
    },
    {
      category: 'package_manager',
      subCategory: 'pnpm_store',
      description: '扫描Pnpm存储...',
      scanFn: () => {
        const pnpmStore = path.join(LOCALAPPDATA, 'pnpm-store')
        const items = addExistingDirectory(pnpmStore, 'package_manager', 'pnpm_store', 'Pnpm内容寻址存储')
        found.count += items.length
        return items
      }
    },
    {
      category: 'ide_cache',
      subCategory: 'vscode_cache',
      description: '扫描VSCode缓存...',
      scanFn: () => {
        const vscodePaths = [
          path.join(APPDATA, 'Code', 'Cache'),
          path.join(APPDATA, 'Code', 'Code Cache'),
          path.join(APPDATA, 'Code', 'GPUCache'),
          path.join(APPDATA, 'Code', 'CachedData'),
          path.join(APPDATA, 'Code', 'CachedExtensions'),
          path.join(APPDATA, 'Code', 'Service Worker', 'CacheStorage'),
          path.join(APPDATA, 'Code', 'User', 'workspaceStorage'),
          path.join(APPDATA, 'Code - Insiders', 'Cache'),
          path.join(APPDATA, 'Code - Insiders', 'Code Cache'),
          path.join(APPDATA, 'Code - Insiders', 'GPUCache'),
          path.join(APPDATA, 'VSCodium', 'Cache'),
          path.join(APPDATA, 'VSCodium', 'Code Cache')
        ]
        let items: ScanItem[] = []
        for (const p of vscodePaths) {
          items.push(...addExistingDirectory(p, 'ide_cache', 'vscode_cache', 'VSCode缓存文件'))
        }
        found.count += items.length
        return items
      }
    },
    {
      category: 'ide_cache',
      subCategory: 'vscode_extensions',
      description: '扫描废弃VSCode扩展...',
      scanFn: () => {
        const extensionsDir = path.join(HOME, '.vscode', 'extensions')
        const items: ScanItem[] = []
        if (fs.existsSync(extensionsDir)) {
          const extensions = safeReaddir(extensionsDir)
          const extensionMap = new Map<string, string[]>()
          for (const ext of extensions) {
            if (isCancelled) break
            const match = ext.match(/^(.+)-(\d+\.\d+\.\d+.*)$/)
            if (match) {
              const name = match[1]
              const version = match[2]
              if (!extensionMap.has(name)) {
                extensionMap.set(name, [])
              }
              extensionMap.get(name)!.push(version)
            }
            scanned.count++
          }
          for (const [name, versions] of extensionMap) {
            if (versions.length > 1) {
              versions.sort()
              for (let i = 0; i < versions.length - 1; i++) {
                const oldExt = path.join(extensionsDir, `${name}-${versions[i]}`)
                const stat = safeStat(oldExt)
                if (stat) {
                  items.push(createItem(oldExt, stat, '旧版本VSCode扩展', 'ide_cache', 'vscode_extensions'))
                  found.count++
                }
              }
            }
          }
        }
        return items
      }
    },
    {
      category: 'ide_cache',
      subCategory: 'vs_cache',
      description: '扫描Visual Studio缓存...',
      scanFn: () => {
        const vsPaths = [
          path.join(LOCALAPPDATA, 'Microsoft', 'VisualStudio', 'ComponentModelCache'),
          path.join(LOCALAPPDATA, 'Microsoft', 'VisualStudio', '16.0', 'ComponentModelCache'),
          path.join(LOCALAPPDATA, 'Microsoft', 'VisualStudio', '17.0', 'ComponentModelCache'),
          path.join(LOCALAPPDATA, 'Microsoft', 'WebsiteCache'),
          path.join(APPDATA, 'Microsoft', 'VisualStudio')
        ]
        let items: ScanItem[] = []
        for (const p of vsPaths) {
          items.push(...addExistingDirectory(p, 'ide_cache', 'vs_cache', 'Visual Studio缓存'))
        }
        found.count += items.length
        return items
      }
    },
    {
      category: 'ide_cache',
      subCategory: 'intellij_cache',
      description: '扫描JetBrains IDE缓存...',
      scanFn: () => {
        const jetbrainsDir = path.join(APPDATA, 'JetBrains')
        const items: ScanItem[] = []
        if (fs.existsSync(jetbrainsDir)) {
          const dirs = safeReaddir(jetbrainsDir)
          for (const dir of dirs) {
            if (isCancelled) break
            const systemCache = path.join(jetbrainsDir, dir, 'system')
            items.push(...addExistingDirectory(systemCache, 'ide_cache', 'intellij_cache', 'JetBrains IDE系统缓存'))
            scanned.count++
          }
        }
        found.count += items.length
        return items
      }
    },
    {
      category: 'system_update',
      subCategory: 'windows_update_cache',
      description: '扫描Windows更新缓存...',
      scanFn: () => {
        const updatePaths = [
          path.join(WINDIR, 'SoftwareDistribution', 'Download'),
          path.join(WINDIR, 'SoftwareDistribution', 'DataStore'),
          path.join(WINDIR, 'SoftwareDistribution', 'PostRebootEventCache.V2')
        ]
        let items: ScanItem[] = []
        for (const p of updatePaths) {
          items.push(...addExistingDirectory(p, 'system_update', 'windows_update_cache', 'Windows更新下载缓存'))
        }
        found.count += items.length
        return items
      }
    },
    {
      category: 'system_update',
      subCategory: 'windows_old',
      description: '扫描Windows.old...',
      scanFn: () => {
        const windowsOld = path.join(path.parse(WINDIR).root, 'Windows.old')
        const items = addExistingDirectory(windowsOld, 'system_update', 'windows_old', '旧版Windows系统备份')
        found.count += items.length
        return items
      }
    },
    {
      category: 'system_update',
      subCategory: 'update_logs',
      description: '扫描更新日志...',
      scanFn: () => {
        const updateLogPaths = [
          path.join(WINDIR, 'Logs', 'CBS'),
          path.join(WINDIR, 'Logs', 'DISM'),
          path.join(WINDIR, 'INF', 'setupapi.dev.log'),
          path.join(WINDIR, 'INF', 'setupapi.setup.log'),
          path.join(WINDIR, 'Panther')
        ]
        let items: ScanItem[] = []
        for (const p of updateLogPaths) {
          const stat = safeStat(p)
          if (stat) {
            items.push(createItem(p, stat, 'Windows更新/安装日志', 'system_update', 'update_logs'))
          }
        }
        found.count += items.length
        return items
      }
    },
    {
      category: 'system_update',
      subCategory: 'delivery_optimization',
      description: '扫描传递优化文件...',
      scanFn: () => {
        const doPath = path.join(PROGRAMDATA, 'Microsoft', 'Windows', 'DeliveryOptimization', 'Cache')
        const items = addExistingDirectory(doPath, 'system_update', 'delivery_optimization', 'Windows传递优化缓存')
        found.count += items.length
        return items
      }
    },
    {
      category: 'program_files',
      subCategory: 'program_logs',
      description: '扫描应用程序日志...',
      scanFn: () => {
        let items: ScanItem[] = []
        const searchPaths = [PROGRAMFILES, PROGRAMFILES_X86, PROGRAMDATA]
        for (const base of searchPaths) {
          items = items.concat(
            scanDirectoryForFiles(base, ['.log'], 'program_files', 'program_logs', '应用程序日志文件', 3, 0, scanned, found)
          )
        }
        return items
      }
    },
    {
      category: 'program_files',
      subCategory: 'program_cache',
      description: '扫描应用程序缓存...',
      scanFn: () => {
        return scanDirectoryPatterns(
          PROGRAMDATA,
          ['cache', 'caches', 'temp'],
          'program_files',
          'program_cache',
          'ProgramData应用缓存',
          true,
          scanned,
          found
        )
      }
    },
    {
      category: 'program_files',
      subCategory: 'uninstall_residual',
      description: '扫描卸载残留...',
      scanFn: () => {
        const items: ScanItem[] = []
        for (const base of [PROGRAMFILES, PROGRAMFILES_X86, PROGRAMDATA]) {
          if (fs.existsSync(base)) {
            const entries = safeReaddir(base)
            for (const entry of entries) {
              if (isCancelled) break
              const full = path.join(base, entry)
              const stat = safeStat(full)
              if (stat && stat.isDirectory()) {
                try {
                  const subEntries = fs.readdirSync(full)
                  if (subEntries.length === 0) {
                    items.push(createItem(full, stat, '空目录/可能的卸载残留', 'program_files', 'uninstall_residual'))
                    found.count++
                  }
                } catch {
                  continue
                }
              }
              scanned.count++
            }
          }
        }
        return items
      }
    },
    {
      category: 'backup_fragment',
      subCategory: 'old_backups',
      description: '扫描废弃备份文件...',
      scanFn: () => {
        const backupExts = ['.bak', '.backup', '.old', '.tmp', '.orig', '.~']
        let items: ScanItem[] = []
        items = items.concat(
          scanDirectoryForFiles(APPDATA, backupExts, 'backup_fragment', 'old_backups', '备份/临时文件', 4, 0, scanned, found)
        )
        items = items.concat(
          scanDirectoryForFiles(LOCALAPPDATA, backupExts, 'backup_fragment', 'old_backups', '备份/临时文件', 4, 0, scanned, found)
        )
        return items
      }
    },
    {
      category: 'backup_fragment',
      subCategory: 'installer_temp',
      description: '扫描安装临时文件...',
      scanFn: () => {
        const installPatterns = ['$', 'msiexec', 'install', 'setup']
        let items: ScanItem[] = []
        const tempDir = process.env.TEMP || path.join(LOCALAPPDATA, 'Temp')
        if (fs.existsSync(tempDir)) {
          items = items.concat(
            scanDirectoryPatterns(
              tempDir,
              installPatterns,
              'backup_fragment',
              'installer_temp',
              '软件安装临时解压文件',
              true,
              scanned,
              found
            )
          )
        }
        const msiCache = path.join(WINDIR, 'Installer', '$PatchCache$')
        items = items.concat(addExistingDirectory(msiCache, 'backup_fragment', 'installer_temp', 'MSI补丁缓存'))
        found.count += items.filter((i) => !items.includes(i)).length
        return items
      }
    },
    {
      category: 'backup_fragment',
      subCategory: 'download_cache',
      description: '扫描下载缓存...',
      scanFn: () => {
        const downloadDirs = [
          path.join(HOME, 'Downloads', '.cache'),
          path.join(APPDATA, 'Thunder', 'Profiles'),
          path.join(APPDATA, 'Xunlei'),
          path.join(LOCALAPPDATA, 'Microsoft', 'Windows', 'INetCache'),
          path.join(LOCALAPPDATA, 'Microsoft', 'Windows', 'Temporary Internet Files')
        ]
        let items: ScanItem[] = []
        for (const d of downloadDirs) {
          items.push(...addExistingDirectory(d, 'backup_fragment', 'download_cache', '下载缓存/浏览器下载临时文件'))
        }
        found.count += items.length
        return items
      }
    }
  ]
}

export async function runScan(): Promise<Map<string, Map<string, ScanItem[]>>> {
  isCancelled = false
  const results = new Map<string, Map<string, ScanItem[]>>()
  const tasks = buildScanTasks()
  const totalTasks = tasks.length

  for (let i = 0; i < tasks.length; i++) {
    if (isCancelled) break
    const task = tasks[i]
    reportProgress(task.description, Math.floor((i / totalTasks) * 100), 0, 0)

    const items = task.scanFn()

    if (!results.has(task.category)) {
      results.set(task.category, new Map())
    }
    const subMap = results.get(task.category)!
    subMap.set(task.subCategory, items)
  }

  reportProgress('扫描完成', 100, 0, 0)
  return results
}

export function getCategoryDefinitions(): typeof SCAN_CATEGORIES {
  return SCAN_CATEGORIES
}

export function calculateCategorySizes(
  results: Map<string, Map<string, ScanItem[]>>
): Map<string, Map<string, ScanSubCategory>> {
  const sizeMap = new Map<string, Map<string, ScanSubCategory>>()

  for (const category of SCAN_CATEGORIES) {
    if (!results.has(category.id)) continue
    const subMap = new Map<string, ScanSubCategory>()
    const resultSubs = results.get(category.id)!

    for (const sub of category.subCategories) {
      const items = resultSubs.get(sub.id) || []
      const totalSize = items.reduce((sum, item) => sum + item.size, 0)
      subMap.set(sub.id, {
        ...sub,
        items,
        totalSize
      })
    }
    sizeMap.set(category.id, subMap)
  }

  return sizeMap
}
