/// <reference types="vite/client" />

import type { ApiType, ScanCategory, ScanItem, ScanProgress, CleanProgress, CleanResult, ScanSubCategory } from '../../preload/index'

declare global {
  interface Window {
    api: ApiType
  }
}

export {}
export type { ApiType, ScanCategory, ScanItem, ScanProgress, CleanProgress, CleanResult, ScanSubCategory }
