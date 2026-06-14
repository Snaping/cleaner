export function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

export function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    return date.toLocaleString('zh-CN')
  } catch {
    return dateStr
  }
}

export function truncatePath(path: string, maxLength: number = 70): string {
  if (path.length <= maxLength) return path
  const start = path.substring(0, Math.floor(maxLength / 2) - 2)
  const end = path.substring(path.length - Math.floor(maxLength / 2) + 1)
  return `${start}...${end}`
}
