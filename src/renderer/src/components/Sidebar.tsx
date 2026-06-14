import React from 'react'
import type { ScanCategory } from '../env.d'
import { formatSize } from '../utils'

interface SidebarProps {
  categories: ScanCategory[]
  activeCategory: string | null
  onSelectCategory: (id: string) => void
  selectedItems: Set<string>
  onToggleCategory: (categoryId: string, checked: boolean) => void
}

const Sidebar: React.FC<SidebarProps> = ({
  categories,
  activeCategory,
  onSelectCategory,
  selectedItems,
  onToggleCategory
}) => {
  const getCategoryTotalSize = (cat: ScanCategory): number => {
    return cat.subCategories.reduce((sum, sub) => sum + sub.totalSize, 0)
  }

  const getCategoryItemCount = (cat: ScanCategory): number => {
    return cat.subCategories.reduce((sum, sub) => sum + sub.items.length, 0)
  }

  const isCategorySelected = (cat: ScanCategory): boolean => {
    const allPaths = cat.subCategories.flatMap((sub) => sub.items.map((item) => item.path))
    if (allPaths.length === 0) return false
    return allPaths.every((p) => selectedItems.has(p))
  }

  const isCategoryIndeterminate = (cat: ScanCategory): boolean => {
    const allPaths = cat.subCategories.flatMap((sub) => sub.items.map((item) => item.path))
    if (allPaths.length === 0) return false
    const selectedCount = allPaths.filter((p) => selectedItems.has(p)).length
    return selectedCount > 0 && selectedCount < allPaths.length
  }

  return (
    <div className="sidebar">
      {categories.map((cat) => {
        const totalSize = getCategoryTotalSize(cat)
        const itemCount = getCategoryItemCount(cat)
        const selected = isCategorySelected(cat)
        const indeterminate = isCategoryIndeterminate(cat)

        return (
          <div key={cat.id}>
            <div
              className={`sidebar-category ${activeCategory === cat.id ? 'active' : ''}`}
              onClick={() => onSelectCategory(cat.id)}
            >
              <div className="sidebar-category-header">
                <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                  <span className="sidebar-category-icon">{cat.icon}</span>
                  <span className="sidebar-category-name">{cat.name}</span>
                </div>
                <span className="sidebar-category-size">{itemCount > 0 ? formatSize(totalSize) : ''}</span>
              </div>
              <div className="sidebar-category-desc">{cat.description}</div>
            </div>
            {itemCount > 0 && (
              <label className="category-checkbox" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={selected}
                  ref={(el) => {
                    if (el) el.indeterminate = indeterminate
                  }}
                  onChange={(e) => onToggleCategory(cat.id, e.target.checked)}
                />
                <span>{itemCount} 项</span>
              </label>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default Sidebar
