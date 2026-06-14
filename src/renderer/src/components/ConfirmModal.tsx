import React from 'react'
import { formatSize } from '../utils'

interface ConfirmModalProps {
  isOpen: boolean
  itemCount: number
  totalSize: number
  needsElevation: boolean
  onConfirm: () => void
  onCancel: () => void
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  itemCount,
  totalSize,
  needsElevation,
  onConfirm,
  onCancel
}) => {
  if (!isOpen) return null

  return (
    <div className="confirm-modal-overlay" onClick={onCancel}>
      <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-modal-title">
          <span className="icon">⚠️</span>
          <span>确认清理</span>
        </div>
        <div className="confirm-modal-desc">
          您即将永久删除以下选中的垃圾文件，此操作不可撤销。
        </div>
        <div className="confirm-modal-warn">
          ⚠️ 删除前请确保相关程序已关闭，否则部分文件可能无法删除。
          {needsElevation && (
            <>
              <br />
              🔒 部分文件需要管理员权限才能删除，将自动请求权限提升。
            </>
          )}
        </div>
        <div className="confirm-modal-stats">
          <div className="confirm-stat">
            <div className="confirm-stat-label">文件数量</div>
            <div className="confirm-stat-value">{itemCount} 项</div>
          </div>
          <div className="confirm-stat">
            <div className="confirm-stat-label">预计释放空间</div>
            <div className="confirm-stat-value">{formatSize(totalSize)}</div>
          </div>
        </div>
        <div className="confirm-modal-actions">
          <button className="btn btn-secondary" onClick={onCancel}>
            取消
          </button>
          <button className="btn btn-danger" onClick={onConfirm}>
            {needsElevation ? '🔐 请求权限并清理' : '🗑️ 确认删除'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmModal
