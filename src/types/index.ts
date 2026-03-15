// 照片資訊 (来自 Rust 後端)
export interface PhotoInfo {
    id: string
    path: string
    filename: string
    width: number
    height: number
}

// 照片卡片在螢幕上的渲染狀態
export interface PhotoCard {
    id: string
    photo: PhotoInfo
    thumbnail: string // 在展示時才載入的 base64

    // 位置與旋轉
    x: number        // 左上角 x (px)
    y: number        // 左上角 y (px)
    rotate: number   // 旋轉角度 (deg)
    zIndex: number

    // 尺寸
    displayWidth: number
    displayHeight: number

    // 視覺
    filterClass: string

    // 動畫狀態
    state: 'entering' | 'visible' | 'leaving'
    enterDelay: number

    // Ken Burns
    kenBurns: boolean
    isMain: boolean
}

// 應用設定
export interface AppSettings {
    // 照片來源
    sourceFolder: string

    // 顯示速度 (秒：每張照片存活時間)
    speed: 'slow' | 'medium' | 'fast'

    // 顯示文字
    showCaption: boolean

    // 隨機順序
    randomOrder: boolean

    // 同時顯示張數
    maxVisible: number

    // Ken Burns 效果
    kenBurnsEnabled: boolean
}

// 速度對應表 (ms)
export const SPEED_MAP: Record<AppSettings['speed'], { lifespan: number; interval: number }> = {
    slow: { lifespan: 115000, interval: 14500 },
    medium: { lifespan: 18000, interval: 12500 },
    fast: { lifespan: 6000, interval: 1800 },
}
