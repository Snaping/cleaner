import type { ApiType, ScanCategory, ScanItem, ScanProgress, CleanProgress, CleanResult, ScanSubCategory } from './index'

declare global {
  interface Window {
    electron: typeof import('@electron-toolkit/preload').electronAPI
    api: ApiType
  }
}

export {}
export type { ApiType, ScanCategory, ScanItem, ScanProgress, CleanProgress, CleanResult, ScanSubCategory }
