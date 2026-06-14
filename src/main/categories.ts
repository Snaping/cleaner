import type { ScanCategory } from './types'

export const SCAN_CATEGORIES: ScanCategory[] = [
  {
    id: 'system_temp',
    name: '系统临时文件',
    icon: '📁',
    description: 'Windows系统运行产生的临时文件、日志、缓存等',
    subCategories: [
      {
        id: 'windows_temp',
        name: 'Windows临时目录',
        description: '系统临时文件夹 (C:\\Windows\\Temp)',
        items: [],
        totalSize: 0
      },
      {
        id: 'user_temp',
        name: '用户临时目录',
        description: '用户临时文件夹 (%TEMP%)',
        items: [],
        totalSize: 0
      },
      {
        id: 'prefetch',
        name: '预读取文件',
        description: 'Windows预读取缓存，加速应用启动的临时文件',
        items: [],
        totalSize: 0
      },
      {
        id: 'thumbnails',
        name: '缩略图缓存',
        description: '资源管理器的图片缩略图缓存',
        items: [],
        totalSize: 0
      },
      {
        id: 'memory_dump',
        name: '内存转储文件',
        description: '系统崩溃时生成的内存转储文件',
        items: [],
        totalSize: 0
      },
      {
        id: 'system_logs',
        name: '系统日志文件',
        description: 'Windows系统日志和事件日志',
        items: [],
        totalSize: 0
      },
      {
        id: 'winsxs_backup',
        name: 'WinSxS备份缓存',
        description: 'Windows组件存储中的备份文件',
        items: [],
        totalSize: 0
      }
    ]
  },
  {
    id: 'appdata_cache',
    name: '应用数据缓存',
    icon: '💾',
    description: 'AppData目录下的各种应用缓存和临时文件',
    subCategories: [
      {
        id: 'appdata_local_temp',
        name: 'AppData临时文件',
        description: 'Local AppData中的各类临时文件',
        items: [],
        totalSize: 0
      },
      {
        id: 'appdata_roaming_cache',
        name: '漫游应用缓存',
        description: 'Roaming AppData中的缓存文件',
        items: [],
        totalSize: 0
      },
      {
        id: 'crash_reports',
        name: '崩溃报告',
        description: '应用程序崩溃时生成的报告文件',
        items: [],
        totalSize: 0
      },
      {
        id: 'browser_cache',
        name: '浏览器缓存',
        description: 'Chrome、Edge、Firefox等浏览器缓存',
        items: [],
        totalSize: 0
      },
      {
        id: 'electron_cache',
        name: 'Electron应用缓存',
        description: '各类基于Electron的应用缓存',
        items: [],
        totalSize: 0
      },
      {
        id: 'media_cache',
        name: '媒体软件缓存',
        description: '视频、音乐播放器的缓存文件',
        items: [],
        totalSize: 0
      }
    ]
  },
  {
    id: 'package_manager',
    name: '包管理器缓存',
    icon: '📦',
    description: '各种开发工具和包管理器产生的缓存文件',
    subCategories: [
      {
        id: 'npm_cache',
        name: 'NPM缓存',
        description: 'Node.js包管理器缓存',
        items: [],
        totalSize: 0
      },
      {
        id: 'yarn_cache',
        name: 'Yarn缓存',
        description: 'Yarn包管理器缓存',
        items: [],
        totalSize: 0
      },
      {
        id: 'pip_cache',
        name: 'Pip缓存',
        description: 'Python包管理器缓存',
        items: [],
        totalSize: 0
      },
      {
        id: 'nuget_cache',
        name: 'NuGet缓存',
        description: '.NET包管理器缓存',
        items: [],
        totalSize: 0
      },
      {
        id: 'maven_cache',
        name: 'Maven缓存',
        description: 'Java Maven依赖缓存',
        items: [],
        totalSize: 0
      },
      {
        id: 'gradle_cache',
        name: 'Gradle缓存',
        description: 'Java Gradle构建缓存',
        items: [],
        totalSize: 0
      },
      {
        id: 'cargo_cache',
        name: 'Cargo缓存',
        description: 'Rust包管理器缓存',
        items: [],
        totalSize: 0
      },
      {
        id: 'go_cache',
        name: 'Go模块缓存',
        description: 'Go语言模块缓存',
        items: [],
        totalSize: 0
      },
      {
        id: 'pnpm_store',
        name: 'Pnpm存储',
        description: 'Pnpm包管理器内容寻址存储',
        items: [],
        totalSize: 0
      }
    ]
  },
  {
    id: 'ide_cache',
    name: 'IDE和编辑器缓存',
    icon: '💻',
    description: 'VSCode、Visual Studio等IDE产生的缓存',
    subCategories: [
      {
        id: 'vscode_cache',
        name: 'VSCode缓存',
        description: 'Visual Studio Code缓存和工作区存储',
        items: [],
        totalSize: 0
      },
      {
        id: 'vscode_extensions',
        name: '废弃VSCode扩展',
        description: '已卸载扩展的残留文件和旧版本扩展',
        items: [],
        totalSize: 0
      },
      {
        id: 'vs_cache',
        name: 'Visual Studio缓存',
        description: 'Visual Studio的组件缓存和临时文件',
        items: [],
        totalSize: 0
      },
      {
        id: 'intellij_cache',
        name: 'JetBrains IDE缓存',
        description: 'IntelliJ IDEA、PyCharm等IDE的系统缓存',
        items: [],
        totalSize: 0
      }
    ]
  },
  {
    id: 'system_update',
    name: '系统更新垃圾',
    icon: '🔄',
    description: 'Windows更新、旧版本系统备份等',
    subCategories: [
      {
        id: 'windows_update_cache',
        name: 'Windows更新缓存',
        description: '已下载的Windows更新安装包缓存',
        items: [],
        totalSize: 0
      },
      {
        id: 'windows_old',
        name: 'Windows.old',
        description: '旧版Windows系统备份文件夹',
        items: [],
        totalSize: 0
      },
      {
        id: 'update_logs',
        name: '更新日志',
        description: 'Windows更新日志和回滚文件',
        items: [],
        totalSize: 0
      },
      {
        id: 'delivery_optimization',
        name: '传递优化文件',
        description: 'Windows传递优化的下载缓存文件',
        items: [],
        totalSize: 0
      }
    ]
  },
  {
    id: 'program_files',
    name: '应用程序垃圾',
    icon: '🗑️',
    description: 'Program Files中的应用残留、日志、缓存等',
    subCategories: [
      {
        id: 'program_logs',
        name: '应用程序日志',
        description: '各类应用产生的日志文件',
        items: [],
        totalSize: 0
      },
      {
        id: 'program_cache',
        name: '应用程序缓存',
        description: 'ProgramData中的应用缓存',
        items: [],
        totalSize: 0
      },
      {
        id: 'uninstall_residual',
        name: '卸载残留',
        description: '软件卸载后残留的空文件夹和配置文件',
        items: [],
        totalSize: 0
      }
    ]
  },
  {
    id: 'backup_fragment',
    name: '备份与碎片文件',
    icon: '📋',
    description: '旧备份文件、安装包碎片、临时安装文件等',
    subCategories: [
      {
        id: 'old_backups',
        name: '废弃备份文件',
        description: '.bak、.backup、.old等旧备份文件',
        items: [],
        totalSize: 0
      },
      {
        id: 'installer_temp',
        name: '安装临时文件',
        description: '软件安装时产生的临时解压文件',
        items: [],
        totalSize: 0
      },
      {
        id: 'download_cache',
        name: '下载缓存',
        description: '各类下载器的缓存和未完成下载',
        items: [],
        totalSize: 0
      }
    ]
  }
]
