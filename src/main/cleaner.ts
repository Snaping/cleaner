import * as fs from 'fs'
import * as path from 'path'
import type { CleanProgress, CleanResult, ScanItem } from './types'

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

function safeDeleteFile(filePath: string): boolean {
  try {
    if (fs.existsSync(filePath)) {
      const stat = fs.statSync(filePath)
      if (stat.isFile()) {
        fs.unlinkSync(filePath)
      } else if (stat.isDirectory()) {
        deleteDirectoryRecursive(filePath)
      }
      return true
    }
    return true
  } catch {
    return false
  }
}

function deleteDirectoryRecursive(dirPath: string): void {
  if (!fs.existsSync(dirPath)) return
  try {
    const entries = fs.readdirSync(dirPath)
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry)
      try {
        const stat = fs.statSync(fullPath)
        if (stat.isDirectory()) {
          deleteDirectoryRecursive(fullPath)
        } else {
          fs.unlinkSync(fullPath)
        }
      } catch {
        continue
      }
    }
    try {
      fs.rmdirSync(dirPath)
    } catch {
      // ignore rmdir errors if not empty
    }
  } catch {
    // ignore readdir errors
  }
}

function getFileOrDirSize(targetPath: string): number {
  try {
    if (!fs.existsSync(targetPath)) return 0
    const stat = fs.statSync(targetPath)
    if (stat.isFile()) return stat.size
    if (stat.isDirectory()) {
      let size = 0
      const entries = fs.readdirSync(targetPath)
      for (const entry of entries) {
        try {
          size += getFileOrDirSize(path.join(targetPath, entry))
        } catch {
          continue
        }
      }
      return size
    }
  } catch {
    return 0
  }
  return 0
}

export async function runClean(items: ScanItem[]): Promise<CleanResult> {
  isCleaningCancelled = false
  const totalItems = items.length
  let cleanedCount = 0
  let totalFreed = 0
  const failedItems: string[] = []

  for (let i = 0; i < items.length; i++) {
    if (isCleaningCancelled) break
    const item = items[i]

    reportCleanProgress(item.path, Math.floor(((i + 1) / totalItems) * 100), cleanedCount, totalItems, totalFreed, failedItems)

    const sizeBefore = getFileOrDirSize(item.path)
    const success = safeDeleteFile(item.path)

    if (success) {
      cleanedCount++
      totalFreed += sizeBefore
    } else {
      failedItems.push(item.path)
    }

    // Small delay to allow UI updates
    await new Promise((resolve) => setTimeout(resolve, 10))
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
