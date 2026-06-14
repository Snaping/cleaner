import React from 'react'
import type { ScanCategory, ScanSubCategory } from '../env.d'
import { formatSize, formatDate, truncatePath } from '../utils'

interface FileListProps {
  activeCategory: string | null
  activeSubCategory: string | null
  categories: ScanCategory[]
  selectedItems: Set<string>
  onToggleItem: (path: string) => void
  onSelectSubCategory: (id: string) => void
  onToggleSubCategory: (subCategory: ScanSubCategory, checked: boolean) => void
}

const FileList: React.FC<FileListProps> = ({
  activeCategory,
  activeSubCategory,
  categories,
  selectedItems,
  onToggleItem,
  onSelectSubCategory,
  onToggleSubCategory
}) => {
  const activeCat = categories.find((c) => c.id === activeCategory)

  if (!activeCat) {
    return (
      <div className="empty-state">
        <div className="empty-icon">🧹</div>
        <div className="empty-title">选择左侧分类查看详情</div>
        <div className="empty-desc">从左侧选择一个垃圾分类，查看可清理的具体文件和目录</div>
      </div>
    )
  }

  const activeSub = activeCat.subCategories.find((s) => s.id === activeSubCategory)
  const hasItems = activeCat.subCategories.some((s) => s.items.length > 0)

  if (!hasItems) {
    return (
      <div className="file-list-area">
        <div className="subcategory-tabs">
          {activeCat.subCategories.map((sub) => (
            <button
              key={sub.id}
              className={`subcategory-tab ${sub.id === activeSubCategory ? 'active' : ''}`}
              onClick={() => onSelectSubCategory(sub.id)}
            >
              {sub.name}
              <span className="subcategory-count">{sub.items.length}</span>
            </button>
          ))}
        </div>
        <div className="empty-state">
          <div className="empty-icon">✅</div>
          <div className="empty-title">此分类暂无垃圾文件</div>
          <div className="empty-desc">
            {activeCat.name}目录下暂未发现可清理的垃圾文件，系统很干净！
          </div>
        </div>
      </div>
    )
  }

  const displayItems = activeSub ? activeSub.items : activeCat.subCategories.flatMap((s) => s.items)

  const isSubSelected = (sub: ScanSubCategory): boolean => {
    if (sub.items.length === 0) return false
    return sub.items.every((item) => selectedItems.has(item.path))
  }

  const isSubIndeterminate = (sub: ScanSubCategory): boolean => {
    if (sub.items.length === 0) return false
    const selected = sub.items.filter((item) => selectedItems.has(item.path)).length
    return selected > 0 && selected < sub.items.length
  }

  const currentSub = activeSub || activeCat.subCategories.find((s) => s.items.length > 0)

  return (
    <div className="file-list-area">
      <div className="subcategory-tabs">
        {activeCat.subCategories.map((sub) => (
          <button
            key={sub.id}
            className={`subcategory-tab ${sub.id === activeSubCategory ? 'active' : ''}`}
            onClick={() => onSelectSubCategory(sub.id)}
          >
            {sub.name}
            <span className="subcategory-count">{sub.items.length}</span>
          </button>
        ))}
      </div>

      {currentSub && currentSub.items.length > 0 && (
        <div className="subcategory-info">
          <span className="subcategory-desc">
            {currentSub.description} · 共 {currentSub.items.length} 项 · {formatSize(currentSub.totalSize)}
          </span>
          <label className="subcategory-check-all">
            <input
              type="checkbox"
              checked={isSubSelected(currentSub)}
              ref={(el) => {
                if (el) el.indeterminate = isSubIndeterminate(currentSub)
              }}
              onChange={(e) => onToggleSubCategory(currentSub, e.target.checked)}
            />
            <span>全选此分类</span>
          </label>
        </div>
      )}

      <div className="file-list">
        {displayItems.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📁</div>
            <div className="empty-title">此子分类暂无垃圾文件</div>
          </div>
        ) : (
          displayItems.map((item) => (
            <div
              key={item.path}
              className="file-item"
              onClick={() => onToggleItem(item.path)}
              title={item.path}
            >
              <input
                type="checkbox"
                className="file-checkbox"
                checked={selectedItems.has(item.path)}
                onChange={() => onToggleItem(item.path)}
                onClick={(e) => e.stopPropagation()}
              />
              <span className="file-icon">{item.needsElevation ? '🔒' : '📄'}</span>
              <div className="file-info">
                <div className="file-path" title={item.path}>
                  {truncatePath(item.path)}
                </div>
                <div className="file-details">
                  <span className="file-reason">{item.reason}</span>
                  <span>修改于: {formatDate(item.lastModified)}</span>
                </div>
              </div>
              {item.needsElevation && <span className="file-elevated">需权限</span>}
              <span className="file-size">{formatSize(item.size)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default FileList
