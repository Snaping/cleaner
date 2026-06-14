import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import * as sudo from 'sudo-prompt'
import * as fs from 'fs'
import * as os from 'os'

import {
  runScan,
  setProgressCallback,
  getCategoryDefinitions,
  calculateCategorySizes
} from './scanner'
import {
  runClean,
  setCleanProgressCallback,
  generateElevatedCleanScript
} from './cleaner'
import type { ScanItem, CleanResult, ScanCategory } from './types'

let mainWindow: BrowserWindow | null = null
let currentScanResults: Map<string, Map<string, ScanItem[]>> = new Map()

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    frame: false,
    backgroundColor: '#1a1a2e',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function setupIpcHandlers(): void {
  ipcMain.handle('window:minimize', () => {
    mainWindow?.minimize()
  })

  ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow?.unmaximize()
    } else {
      mainWindow?.maximize()
    }
  })

  ipcMain.handle('window:close', () => {
    mainWindow?.close()
  })

  ipcMain.handle('window:isMaximized', () => {
    return mainWindow?.isMaximized() || false
  })

  ipcMain.handle('scan:start', async () => {
    setProgressCallback((progress) => {
      mainWindow?.webContents.send('scan:progress', progress)
    })

    const results = await runScan()
    currentScanResults = results

    const categoryDefs = getCategoryDefinitions()
    const sizeMap = calculateCategorySizes(results)

    const finalCategories: ScanCategory[] = categoryDefs.map((cat) => {
      const subSizeMap = sizeMap.get(cat.id)
      return {
        ...cat,
        subCategories: cat.subCategories.map((sub) => {
          const subData = subSizeMap?.get(sub.id)
          return subData || { ...sub, items: [], totalSize: 0 }
        })
      }
    })

    mainWindow?.webContents.send('scan:result', finalCategories)
    return finalCategories
  })

  ipcMain.handle('clean:start', async (_event, filePaths: string[], allFiles: boolean) => {
    const itemsToClean: ScanItem[] = []

    if (allFiles) {
      for (const subMap of currentScanResults.values()) {
        for (const items of subMap.values()) {
          itemsToClean.push(...items)
        }
      }
    } else {
      const pathSet = new Set(filePaths)
      for (const subMap of currentScanResults.values()) {
        for (const items of subMap.values()) {
          for (const item of items) {
            if (pathSet.has(item.path)) {
              itemsToClean.push(item)
            }
          }
        }
      }
    }

    setCleanProgressCallback((progress) => {
      mainWindow?.webContents.send('clean:progress', progress)
    })

    const normalItems = itemsToClean.filter((item) => !item.needsElevation)
    const elevatedItems = itemsToClean.filter((item) => item.needsElevation)

    const normalResult = normalItems.length > 0 ? await runClean(normalItems) : {
      success: true,
      totalFreed: 0,
      cleanedCount: 0,
      failedCount: 0,
      failedItems: []
    } as CleanResult

    if (elevatedItems.length === 0) {
      mainWindow?.webContents.send('clean:done', normalResult)
      return normalResult
    }

    const totalCount = normalItems.length + elevatedItems.length
    const baseProgress = Math.floor((normalItems.length / totalCount) * 90)

    const reportProgress = (text: string, percent: number): void => {
      mainWindow?.webContents.send('clean:progress', {
        current: text,
        percent: baseProgress + Math.floor(percent * 0.1),
        cleaned: normalResult.cleanedCount,
        total: totalCount,
        freed: normalResult.totalFreed,
        failed: normalResult.failedItems
      })
    }

    reportProgress('正在请求管理员权限...', 0)

    const script = generateElevatedCleanScript(elevatedItems)
    const tempScriptPath = join(os.tmpdir(), `pc-cleaner-${Date.now()}.ps1`)

    try {
      fs.writeFileSync(tempScriptPath, script, 'utf-8')
    } catch (err) {
      dialog.showErrorBox('错误', `无法创建临时脚本: ${err}`)
      const finalResult: CleanResult = {
        success: false,
        totalFreed: normalResult.totalFreed,
        cleanedCount: normalResult.cleanedCount,
        failedCount: normalResult.failedCount + elevatedItems.length,
        failedItems: [...normalResult.failedItems, ...elevatedItems.map((i) => i.path)]
      }
      mainWindow?.webContents.send('clean:progress', {
        current: '清理完成',
        percent: 100,
        cleaned: finalResult.cleanedCount,
        total: totalCount,
        freed: finalResult.totalFreed,
        failed: finalResult.failedItems
      })
      mainWindow?.webContents.send('clean:done', finalResult)
      return finalResult
    }

    const elevatedResult: CleanResult = await new Promise((resolve) => {
      const command = `powershell -ExecutionPolicy Bypass -File "${tempScriptPath}"`

      let progressInterval: ReturnType<typeof setInterval> | null = null
      let simulatedPercent = 0

      progressInterval = setInterval(() => {
        simulatedPercent = Math.min(simulatedPercent + 2, 95)
        reportProgress(`正在以管理员权限清理系统文件... (${simulatedPercent}%)`, simulatedPercent)
      }, 500)

      sudo.exec(command, { name: 'PC Deep Cleaner' }, (error, stdout, stderr) => {
        if (progressInterval) clearInterval(progressInterval)
        try {
          fs.unlinkSync(tempScriptPath)
        } catch {
          // ignore
        }

        if (error) {
          dialog.showErrorBox(
            '权限提升失败',
            `无法以管理员权限执行清理操作: ${error.message}\n未获得权限的文件将保留，您可以手动以管理员身份重新运行程序。`
          )
          resolve({
            success: false,
            totalFreed: 0,
            cleanedCount: 0,
            failedCount: elevatedItems.length,
            failedItems: elevatedItems.map((i) => i.path)
          })
          return
        }

        const output = (stdout as string) + (stderr as string)
        const deleted = output.match(/DELETED:/g)?.length || 0
        const failed = output.match(/FAILED:/g)?.length || 0
        const failedLines = output
          .split('\n')
          .filter((line) => line.startsWith('FAILED:'))
          .map((line) => line.replace('FAILED: ', '').split(' - ')[0].trim())

        let estimatedFreed = 0
        const deletedPaths = output
          .split('\n')
          .filter((line) => line.startsWith('DELETED:'))
          .map((line) => line.replace('DELETED: ', '').trim())

        for (const item of elevatedItems) {
          if (deletedPaths.some((p) => item.path.startsWith(p) || p.startsWith(item.path))) {
            estimatedFreed += item.size
          }
        }

        resolve({
          success: failed === 0,
          totalFreed: estimatedFreed,
          cleanedCount: deleted,
          failedCount: failed,
          failedItems: failedLines
        })
      })
    })

    const finalResult: CleanResult = {
      success: normalResult.success && elevatedResult.success,
      totalFreed: normalResult.totalFreed + elevatedResult.totalFreed,
      cleanedCount: normalResult.cleanedCount + elevatedResult.cleanedCount,
      failedCount: normalResult.failedCount + elevatedResult.failedCount,
      failedItems: [...normalResult.failedItems, ...elevatedResult.failedItems]
    }

    mainWindow?.webContents.send('clean:progress', {
      current: '清理完成',
      percent: 100,
      cleaned: finalResult.cleanedCount,
      total: totalCount,
      freed: finalResult.totalFreed,
      failed: finalResult.failedItems
    })
    mainWindow?.webContents.send('clean:done', finalResult)
    return finalResult
  })

  ipcMain.handle('clean:elevated', async (_event, _filePaths: string[], _allFiles: boolean) => {
    return {
      success: true,
      totalFreed: 0,
      cleanedCount: 0,
      failedCount: 0,
      failedItems: []
    } as CleanResult
  })
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.pc.deepcleaner')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  setupIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
