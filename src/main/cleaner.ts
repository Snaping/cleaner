import * as fs from 'fs'
import * as path from 'path'
import type { CleanProgress, CleanResult, ScanItem } from './types'

const YIELD_INTERVAL = 30

let cleanProgressCallback: ((progress: CleanProgress) => void) | null = null
let isCleaningCancelled = false

export function setCleanProgressCallback(cb: (progress: CleanProgress) => void): void {
  cleanProgressCallback = cb
}

export function cancelCleaning(): void {
  isCleaningCancelled = true
}

function reportCleanProgress(
  current: string,
  percent: number,
  cleaned: number,
  total: number,
  freed: number,
  failed: string[]
): void {
  if (cleanProgressCallback) {
    cleanProgressCallback({ current, percent, cleaned, total, freed, failed })
  }
}

function yieldEventLoop(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve))
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

async function getFileOrDirSizeAsync(
  targetPath: string,
  yieldCounter: { count: number }
): Promise<number> {
  try {
    if (!fs.existsSync(targetPath)) return 0
    const stat = safeStat(targetPath)
    if (!stat) return 0
    if (stat.isFile()) return stat.size
    if (stat.isDirectory()) {
      let size = 0
      const entries = safeReaddir(targetPath)
      for (const entry of entries) {
        if (isCleaningCancelled) break
        try {
          size += await getFileOrDirSizeAsync(path.join(targetPath, entry), yieldCounter)
        } catch {
          continue
        }
        yieldCounter.count++
        if (yieldCounter.count >= YIELD_INTERVAL) {
          yieldCounter.count = 0
          await yieldEventLoop()
        }
      }
      return size
    }
  } catch {
    return 0
  }
  return 0
}

async function deleteDirectoryRecursiveAsync(
  dirPath: string,
  yieldCounter: { count: number }
): Promise<boolean> {
  if (!fs.existsSync(dirPath)) return true
  try {
    const entries = safeReaddir(dirPath)
    for (const entry of entries) {
      if (isCleaningCancelled) break
      const fullPath = path.join(dirPath, entry)
      try {
        const stat = safeStat(fullPath)
        if (stat) {
          if (stat.isDirectory()) {
            await deleteDirectoryRecursiveAsync(fullPath, yieldCounter)
          } else {
            fs.unlinkSync(fullPath)
          }
        }
      } catch {
        continue
      }
      yieldCounter.count++
      if (yieldCounter.count >= YIELD_INTERVAL) {
        yieldCounter.count = 0
        await yieldEventLoop()
      }
    }
    try {
      fs.rmdirSync(dirPath)
    } catch {
      // ignore rmdir errors if not empty
    }
    return true
  } catch {
    return false
  }
}

async function safeDeleteFileAsync(
  filePath: string,
  yieldCounter: { count: number }
): Promise<boolean> {
  try {
    if (fs.existsSync(filePath)) {
      const stat = safeStat(filePath)
      if (stat) {
        if (stat.isFile()) {
          fs.unlinkSync(filePath)
        } else if (stat.isDirectory()) {
          await deleteDirectoryRecursiveAsync(filePath, yieldCounter)
        }
      }
      return true
    }
    return true
  } catch {
    return false
  }
}

export async function runClean(items: ScanItem[]): Promise<CleanResult> {
  isCleaningCancelled = false
  const totalItems = items.length
  let cleanedCount = 0
  let totalFreed = 0
  const failedItems: string[] = []
  const yieldCounter = { count: 0 }

  for (let i = 0; i < items.length; i++) {
    if (isCleaningCancelled) break
    const item = items[i]

    reportCleanProgress(item.path, Math.floor(((i + 1) / totalItems) * 100), cleanedCount, totalItems, totalFreed, failedItems)

    const sizeBefore = await getFileOrDirSizeAsync(item.path, yieldCounter)
    const success = await safeDeleteFileAsync(item.path, yieldCounter)

    if (success) {
      cleanedCount++
      totalFreed += sizeBefore
    } else {
      failedItems.push(item.path)
    }

    yieldCounter.count++
    if (yieldCounter.count >= YIELD_INTERVAL) {
      yieldCounter.count = 0
      await yieldEventLoop()
    }
  }

  reportCleanProgress('清理完成', 100, cleanedCount, totalItems, totalFreed, failedItems)

  return {
    success: failedItems.length === 0,
    totalFreed,
    cleanedCount,
    failedCount: failedItems.length,
    failedItems
  }
}

export function generateElevatedCleanScript(items: ScanItem[]): string {
  const deleteCommands: string[] = []

  for (const item of items) {
    const escapedPath = item.path.replace(/'/g, "''")
    deleteCommands.push(`
      if (Test-Path '${escapedPath}') {
        try {
          $item = Get-Item '${escapedPath}'
          if ($item.PSIsContainer) {
            Remove-Item '${escapedPath}' -Recurse -Force -ErrorAction Stop
          } else {
            Remove-Item '${escapedPath}' -Force -ErrorAction Stop
          }
          Write-Host "DELETED: ${escapedPath}"
        } catch {
          Write-Host "FAILED: ${escapedPath} - $($_.Exception.Message)"
        }
      }
    `)
  }

  return `
$ErrorActionPreference = 'Continue'
Write-Host "Starting elevated cleanup..."
${deleteCommands.join('\n')}
Write-Host "Cleanup complete."
  `
}

export function getElevatedPaths(items: ScanItem[]): ScanItem[] {
  return items.filter((item) => item.needsElevation)
}
