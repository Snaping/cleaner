import React from 'react'
import type { CleanResult } from '../env.d'
import { formatSize } from '../utils'

interface ResultModalProps {
  isOpen: boolean
  result: CleanResult | null
  onClose: () => void
}

const ResultModal: React.FC<ResultModalProps> = ({ isOpen, result, onClose }) => {
  if (!isOpen || !result) return null

  return (
    <div className="result-modal-overlay" onClick={onClose}>
      <div className="result-modal" onClick={(e) => e.stopPropagation()}>
        <div className="result-modal-icon">{result.success ? '🎉' : '⚠️'}</div>
        <div className="result-modal-title">
          {result.success ? '清理完成！' : '清理部分完成'}
        </div>
        <div className="result-modal-desc">
          {result.success
            ? '所有选中的垃圾文件已成功清理。'
            : `有 ${result.failedCount} 个文件未能清理，可能因为正在被使用或权限不足。`}
        </div>
        <div className="result-stats-grid">
          <div className="result-stat-card">
            <div className="result-stat-card-label">成功清理</div>
            <div className="result-stat-card-value success">{result.cleanedCount} 项</div>
          </div>
          <div className="result-stat-card">
            <div className="result-stat-card-label">释放空间</div>
            <div className="result-stat-card-value info">{formatSize(result.totalFreed)}</div>
          </div>
          <div className="result-stat-card">
            <div className="result-stat-card-label">失败数量</div>
            <div className={`result-stat-card-value ${result.failedCount > 0 ? 'danger' : 'success'}`}>
              {result.failedCount} 项
            </div>
          </div>
        </div>
        {result.failedItems && result.failedItems.length > 0 && (
          <div className="failed-list">
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
              以下文件未能删除:
            </div>
            {result.failedItems.slice(0, 20).map((item, i) => (
              <div key={i} className="failed-item" title={item}>
                {item.length > 60 ? '...' + item.slice(-57) : item}
              </div>
            ))}
            {result.failedItems.length > 20 && (
              <div className="failed-item" style={{ color: 'var(--text-secondary)' }}>
                ...还有 {result.failedItems.length - 20} 项
              </div>
            )}
          </div>
        )}
        <button className="btn btn-primary" onClick={onClose} style={{ margin: '0 auto' }}>
          确定
        </button>
      </div>
    </div>
  )
}

export default ResultModal
