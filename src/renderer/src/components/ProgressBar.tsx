import React from 'react'
import type { ScanProgress, CleanProgress } from '../env.d'

interface ProgressBarProps {
  scanProgress: ScanProgress | null
  cleanProgress: CleanProgress | null
  isScanning: boolean
  isCleaning: boolean
}

const ProgressBar: React.FC<ProgressBarProps> = ({
  scanProgress,
  cleanProgress,
  isScanning,
  isCleaning
}) => {
  if (!isScanning && !isCleaning) return null

  const progress = isCleaning ? cleanProgress : scanProgress
  if (!progress) return null

  const percent = progress.percent
  let text = ''

  if (isCleaning) {
    text = cleanProgress?.current || '正在清理...'
  } else {
    text = scanProgress?.current || '正在扫描...'
  }

  return (
    <div className="progress-section">
      <div className="progress-bar-container">
        <div className="progress-bar" style={{ width: `${percent}%` }} />
      </div>
      <div className="progress-info">
        <span className="progress-text" title={text}>
          {text}
        </span>
        <span className="progress-percent">{percent}%</span>
      </div>
    </div>
  )
}

export default ProgressBar
