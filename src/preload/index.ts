import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

export interface ScanProgress {
  current: string
  percent: number
  scanned: number
  found: number
}

export interface CleanProgress {
  current: string
  percent: number
  cleaned: number
  total: number
  freed: number
  failed: string[]
}

export interface CleanResult {
  success: boolean
  totalFreed: number
  cleanedCount: number
  failedCount: number
  failedItems: string[]
}

export interface ScanItem {
  path: string
  size: number
  lastModified: string
  reason: string
  needsElevation: boolean
  category: string
  subCategory: string
}

export interface ScanSubCategory {
  id: string
  name: string
  description: string
  items: ScanItem[]
  totalSize: number
}

export interface ScanCategory {
  id: string
  name: string
  icon: string
  description: string
  subCategories: ScanSubCategory[]
}

const api = {
  scanStart: (): Promise<ScanCategory[]> => ipcRenderer.invoke('scan:start'),

  onScanProgress: (callback: (progress: ScanProgress) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: ScanProgress): void => callback(progress)
    ipcRenderer.on('scan:progress', listener)
    return () => ipcRenderer.removeListener('scan:progress', listener)
  },

  onScanResult: (callback: (result: ScanCategory[]) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, result: ScanCategory[]): void => callback(result)
    ipcRenderer.on('scan:result', listener)
    return () => ipcRenderer.removeListener('scan:result', listener)
  },

  cleanStart: (filePaths: string[], allFiles: boolean): Promise<CleanResult> =>
    ipcRenderer.invoke('clean:start', filePaths, allFiles),

  cleanElevated: (filePaths: string[], allFiles: boolean): Promise<CleanResult> =>
    ipcRenderer.invoke('clean:elevated', filePaths, allFiles),

  onCleanProgress: (callback: (progress: CleanProgress) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: CleanProgress): void => callback(progress)
    ipcRenderer.on('clean:progress', listener)
    return () => ipcRenderer.removeListener('clean:progress', listener)
  },

  onCleanDone: (callback: (result: CleanResult) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, result: CleanResult): void => callback(result)
    ipcRenderer.on('clean:done', listener)
    return () => ipcRenderer.removeListener('clean:done', listener)
  },

  windowMinimize: (): Promise<void> => ipcRenderer.invoke('window:minimize'),
  windowMaximize: (): Promise<void> => ipcRenderer.invoke('window:maximize'),
  windowClose: (): Promise<void> => ipcRenderer.invoke('window:close'),
  windowIsMaximized: (): Promise<boolean> => ipcRenderer.invoke('window:isMaximized')
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}

export type ApiType = typeof api
