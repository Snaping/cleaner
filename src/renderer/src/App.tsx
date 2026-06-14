import React, { useState, useEffect, useCallback, useRef } from 'react'
import TitleBar from './components/TitleBar'
import Sidebar from './components/Sidebar'
import ProgressBar from './components/ProgressBar'
import FileList from './components/FileList'
import ConfirmModal from './components/ConfirmModal'
import ResultModal from './components/ResultModal'
import type {
  ScanCategory,
  ScanProgress,
  CleanProgress,
  CleanResult,
  ScanItem,
  ScanSubCategory
} from './env.d'
import { formatSize } from './utils'

type AppStatus = 'idle' | 'scanning' | 'scanned' | 'cleaning' | 'done'

const App: React.FC = () => {
  const [status, setStatus] = useState<AppStatus>('idle')
  const [categories, setCategories] = useState<ScanCategory[]>([])
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [activeSubCategory, setActiveSubCategory] = useState<string | null>(null)
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null)
  const [cleanProgress, setCleanProgress] = useState<CleanProgress | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showResult, setShowResult] = useState(false)
  const [cleanResult, setCleanResult] = useState<CleanResult | null>(null)

  const isMounted = useRef(true)

  const getAllItems = useCallback((): ScanItem[] => {
    return categories.flatMap((cat) => cat.subCategories.flatMap((sub) => sub.items))
  }, [categories])

  const getSelectedItems = useCallback((): ScanItem[] => {
    const allItems = getAllItems()
    return allItems.filter((item) => selectedItems.has(item.path))
  }, [getAllItems, selectedItems])

  const getTotalSize = useCallback((): number => {
    return categories.reduce(
      (sum, cat) => sum + cat.subCategories.reduce((s, sub) => s + sub.totalSize, 0),
      0
    )
  }, [categories])

  const getTotalItems = useCallback((): number => {
    return categories.reduce((sum, cat) => sum + cat.subCategories.reduce((s, sub) => s + sub.items.length, 0), 0)
  }, [categories])

  const getSelectedSize = useCallback((): number => {
    return getSelectedItems().reduce((sum, item) => sum + item.size, 0)
  }, [getSelectedItems])

  const hasElevatedItems = useCallback((): boolean => {
    return getSelectedItems().some((item) => item.needsElevation)
  }, [getSelectedItems])

  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
    }
  }, [])

  useEffect(() => {
    const unsubScan = window.api.onScanProgress((progress) => {
      if (isMounted.current) setScanProgress(progress)
    })

    const unsubScanResult = window.api.onScanResult((result) => {
      if (isMounted.current) {
        setCategories(result)
        setStatus('scanned')
        const allSelected = new Set<string>()
        result.forEach((cat) => {
          cat.subCategories.forEach((sub) => {
            sub.items.forEach((item) => allSelected.add(item.path))
          })
        })
        setSelectedItems(allSelected)
        if (result.length > 0) {
          setActiveCategory(result[0].id)
          const firstSub = result[0].subCategories.find((s) => s.items.length > 0)
          if (firstSub) setActiveSubCategory(firstSub.id)
        }
      }
    })

    const unsubCleanProgress = window.api.onCleanProgress((progress) => {
      if (isMounted.current) setCleanProgress(progress)
    })

    const unsubCleanDone = window.api.onCleanDone((result) => {
      if (isMounted.current) {
        setCleanResult(result)
        setStatus('done')
        setShowResult(true)
      }
    })

    return () => {
      unsubScan()
      unsubScanResult()
      unsubCleanProgress()
      unsubCleanDone()
    }
  }, [])

  const handleScan = async (): Promise<void> => {
    setStatus('scanning')
    setScanProgress({ current: '准备扫描...', percent: 0, scanned: 0, found: 0 })
    setSelectedItems(new Set())
    setActiveCategory(null)
    setActiveSubCategory(null)
    try {
      await window.api.scanStart()
    } catch (err) {
      console.error('Scan failed:', err)
      setStatus('idle')
    }
  }

  const handleSelectCategory = (id: string): void => {
    setActiveCategory(id)
    const cat = categories.find((c) => c.id === id)
    if (cat) {
      const firstSub = cat.subCategories.find((s) => s.items.length > 0)
      setActiveSubCategory(firstSub?.id || null)
    }
  }

  const handleSelectSubCategory = (id: string): void => {
    setActiveSubCategory(id)
  }

  const handleToggleItem = (path: string): void => {
    setSelectedItems((prev) => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }

  const handleToggleCategory = (categoryId: string, checked: boolean): void => {
    const cat = categories.find((c) => c.id === categoryId)
    if (!cat) return

    setSelectedItems((prev) => {
      const next = new Set(prev)
      cat.subCategories.forEach((sub) => {
        sub.items.forEach((item) => {
          if (checked) {
            next.add(item.path)
          } else {
            next.delete(item.path)
          }
        })
      })
      return next
    })
  }

  const handleToggleSubCategory = (subCategory: ScanSubCategory, checked: boolean): void => {
    setSelectedItems((prev) => {
      const next = new Set(prev)
      subCategory.items.forEach((item) => {
        if (checked) {
          next.add(item.path)
        } else {
          next.delete(item.path)
        }
      })
      return next
    })
  }

  const handleSelectAll = (): void => {
    const allPaths = getAllItems().map((item) => item.path)
    setSelectedItems(new Set(allPaths))
  }

  const handleDeselectAll = (): void => {
    setSelectedItems(new Set())
  }

  const handleCleanClick = (): void => {
    if (selectedItems.size === 0) return
    setShowConfirm(true)
  }

  const handleConfirmClean = async (): Promise<void> => {
    setShowConfirm(false)
    setStatus('cleaning')
    setCleanProgress({ current: '准备清理...', percent: 0, cleaned: 0, total: selectedItems.size, freed: 0, failed: [] })

    try {
      const result = await window.api.cleanStart([...selectedItems], false)
      setCleanResult(result)
      setShowResult(true)
      setStatus('done')
    } catch (err) {
      console.error('Clean failed:', err)
      setStatus('scanned')
    }
  }

  const handleCleanAll = (): void => {
    handleSelectAll()
    setTimeout(() => handleCleanClick(), 50)
  }

  const getStatusText = (): string => {
    switch (status) {
      case 'idle':
        return '就绪'
      case 'scanning':
        return '正在扫描...'
      case 'scanned':
        return '扫描完成'
      case 'cleaning':
        return '正在清理...'
      case 'done':
        return '清理完成'
      default:
        return ''
    }
  }

  const getStatusDotClass = (): string => {
    if (status === 'scanning') return 'scanning'
    if (status === 'cleaning') return 'cleaning'
    return ''
  }

  return (
    <div className="app-container">
      <TitleBar />

      <div className="main-content">
        <Sidebar
          categories={categories}
          activeCategory={activeCategory}
          onSelectCategory={handleSelectCategory}
          selectedItems={selectedItems}
          onToggleCategory={handleToggleCategory}
        />

        <div className="content-area">
          <div className="toolbar">
            <div className="toolbar-left">
              <div className="toolbar-title">
                {status === 'idle' && '🖥️ PC 深度垃圾清理'}
                {status === 'scanning' && '🔍 正在扫描系统垃圾...'}
                {status === 'scanned' && `📊 扫描结果 (${formatSize(getTotalSize())})`}
                {status === 'cleaning' && '🧹 正在清理垃圾文件...'}
                {status === 'done' && '✅ 清理完成'}
              </div>
              {(status === 'scanned' || status === 'cleaning' || status === 'done') && (
                <div className="toolbar-stats">
                  <div className="stat-item">
                    <span>总项数:</span>
                    <span className="stat-value">{getTotalItems()}</span>
                  </div>
                  <div className="stat-item">
                    <span>已选择:</span>
                    <span className="stat-value">{selectedItems.size}</span>
                  </div>
                  <div className="stat-item">
                    <span>可释放:</span>
                    <span className="stat-value">{formatSize(getSelectedSize())}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="toolbar-actions">
              {status === 'scanned' && (
                <>
                  <button className="btn btn-secondary" onClick={handleSelectAll}>
                    <span className="btn-icon">☑️</span>全选
                  </button>
                  <button className="btn btn-secondary" onClick={handleDeselectAll}>
                    <span className="btn-icon">⬜</span>取消全选
                  </button>
                </>
              )}
              {(status === 'idle' || status === 'scanned' || status === 'done') && (
                <button
                  className="btn btn-primary"
                  onClick={handleScan}
                >
                  <span className="btn-icon">🔍</span>
                  {status === 'idle' ? '开始扫描' : '重新扫描'}
                </button>
              )}
              {(status === 'scanned' || status === 'done') && selectedItems.size > 0 && (
                <button
                  className="btn btn-danger"
                  onClick={handleCleanClick}
                >
                  <span className="btn-icon">🗑️</span>
                  清理选中 ({formatSize(getSelectedSize())})
                </button>
              )}
              {(status === 'scanned' || status === 'done') && getTotalItems() > 0 && (
                <button
                  className="btn btn-danger"
                  onClick={handleCleanAll}
                >
                  <span className="btn-icon">⚡</span>
                  一键清理
                </button>
              )}
            </div>
          </div>

          <ProgressBar
            scanProgress={scanProgress}
            cleanProgress={cleanProgress}
            isScanning={status === 'scanning'}
            isCleaning={status === 'cleaning'}
          />

          {status === 'idle' ? (
            <div className="empty-state">
              <div className="empty-icon">🧹</div>
              <div className="empty-title">PC 深度垃圾清理</div>
              <div className="empty-desc">
                点击右上角「开始扫描」按钮，系统将自动扫描以下区域的垃圾文件：
                <br />
                <br />
                • 系统临时文件、日志、缓存
                <br />
                • AppData 目录下的各种应用缓存
                <br />
                • NPM、Pip、NuGet 等包管理器缓存
                <br />
                • VSCode、Visual Studio 等 IDE 缓存
                <br />
                • Windows 更新历史、旧系统备份
                <br />
                • 应用程序残留和卸载残留
                <br />
                • 废弃备份、安装碎片等
              </div>
            </div>
          ) : (
            <FileList
              activeCategory={activeCategory}
              activeSubCategory={activeSubCategory}
              categories={categories}
              selectedItems={selectedItems}
              onToggleItem={handleToggleItem}
              onSelectSubCategory={handleSelectSubCategory}
              onToggleSubCategory={handleToggleSubCategory}
            />
          )}

          <div className="status-bar">
            <div className="status-left">
              <span className={`status-dot ${getStatusDotClass()}`} />
              <span>{getStatusText()}</span>
            </div>
            <div className="status-right">
              <span>PC Deep Cleaner v1.0.0</span>
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={showConfirm}
        itemCount={selectedItems.size}
        totalSize={getSelectedSize()}
        needsElevation={hasElevatedItems()}
        onConfirm={handleConfirmClean}
        onCancel={() => setShowConfirm(false)}
      />

      <ResultModal isOpen={showResult} result={cleanResult} onClose={() => setShowResult(false)} />
    </div>
  )
}

export default App
