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
  generateElevatedCleanScript,
  getElevatedPaths
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

    const result = await runClean(itemsToClean)
    mainWindow?.webContents.send('clean:done', result)
    return result
  })

  ipcMain.handle('clean:elevated', async (_event, filePaths: string[], allFiles: boolean) => {
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

    const elevatedItems = getElevatedPaths(itemsToClean)
    if (elevatedItems.length === 0) {
      return {
        success: true,
        totalFreed: 0,
        cleanedCount: 0,
        failedCount: 0,
        failedItems: []
      } as CleanResult
    }

    const script = generateElevatedCleanScript(elevatedItems)
    const tempScriptPath = join(os.tmpdir(), `pc-cleaner-${Date.now()}.ps1`)

    try {
      fs.writeFileSync(tempScriptPath, script, 'utf-8')
    } catch (err) {
      dialog.showErrorBox('错误', `无法创建临时脚本: ${err}`)
      return {
        success: false,
        totalFreed: 0,
        cleanedCount: 0,
        failedCount: elevatedItems.length,
        failedItems: elevatedItems.map((i) => i.path)
      } as CleanResult
    }

    return new Promise<CleanResult>((resolve) => {
      const command = `powershell -ExecutionPolicy Bypass -File "${tempScriptPath}"`

      sudo.exec(command, { name: 'PC Deep Cleaner' }, (error, stdout, stderr) => {
        try {
          fs.unlinkSync(tempScriptPath)
        } catch {
          // ignore
        }

        if (error) {
          dialog.showErrorBox(
            '权限提升失败',
            `无法以管理员权限执行清理操作: ${error.message}\n请手动以管理员身份运行本程序。`
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
          .map((line) => line.replace('FAILED: ', '').split(' - ')[0])

        resolve({
          success: failed === 0,
          totalFreed: 0,
          cleanedCount: deleted,
          failedCount: failed,
          failedItems: failedLines
        })
      })
    })
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
