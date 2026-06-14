import React from 'react'

const TitleBar: React.FC = () => {
  const handleMinimize = (): void => {
    window.api.windowMinimize()
  }

  const handleMaximize = (): void => {
    window.api.windowMaximize()
  }

  const handleClose = (): void => {
    window.api.windowClose()
  }

  return (
    <div className="titlebar">
      <div className="titlebar-title">
        <span className="titlebar-icon">🧹</span>
        <span>PC 深度清理</span>
      </div>
      <div className="titlebar-controls">
        <button className="titlebar-btn" onClick={handleMinimize} title="最小化">
          —
        </button>
        <button className="titlebar-btn" onClick={handleMaximize} title="最大化">
          □
        </button>
        <button className="titlebar-btn close" onClick={handleClose} title="关闭">
          ✕
        </button>
      </div>
    </div>
  )
}

export default TitleBar
