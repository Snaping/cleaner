export interface ScanItem {
  path: string
  size: number
  lastModified: Date
  reason: string
  needsElevation: boolean
  category: string
  subCategory: string
}

export interface ScanCategory {
  id: string
  name: string
  icon: string
  description: string
  subCategories: ScanSubCategory[]
}

export interface ScanSubCategory {
  id: string
  name: string
  description: string
  items: ScanItem[]
  totalSize: number
}

export interface ScanResult {
  categories: Map<string, ScanCategory>
  totalSize: number
  totalItems: number
}

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
