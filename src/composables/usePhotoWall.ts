/**
 * usePhotoWall — 照片牆核心邏輯
 * 
 * 管理照片池、動畫排程、新舊照片替換
 */

import { ref, computed, onUnmounted, watch } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import type { PhotoInfo, PhotoCard, AppSettings } from '../types'
import { SPEED_MAP } from '../types'
import { useLayout } from './useLayout'

export function usePhotoWall() {
    // ── 狀態 ──
    const allPhotos = ref<PhotoInfo[]>([])
    const visibleCards = ref<PhotoCard[]>([])
    const settings = ref<AppSettings>({
        sourceFolder: '',
        speed: 'medium',
        showCaption: true,
        randomOrder: true,
        kenBurnsEnabled: true,
        maxVisible: 8,
    })

    const isLoading = ref(false)
    const loadProgress = ref(0)
    const hasLoaded = ref(false)
    const error = ref<string | null>(null)

    const { computeCardLayout, refreshSeed } = useLayout()
    const STORAGE_KEY = 'photo-wall-config'

    // ── 持久化 ──
    function saveToStorage() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings.value))
    }

    function loadFromStorage() {
        const data = localStorage.getItem(STORAGE_KEY)
        if (data) {
            try {
                const parsed = JSON.parse(data)
                settings.value = { ...settings.value, ...parsed }
                return true
            } catch (e) {
                console.error('Config load failed', e)
            }
        }
        return false
    }

    // 自動儲存設定
    watch(settings, () => {
        saveToStorage()
    }, { deep: true })

    // ── 排程計時器 ──
    let addTimer: ReturnType<typeof setTimeout> | null = null
    let photoIndex = 0
    let cardIdCounter = 0

    const isRunning = computed(() => allPhotos.value.length > 0)
    const isPromotingMain = ref(false)

    // ── 晉升邏輯 ──
    function promoteNextMain() {
        const candidates = visibleCards.value.filter(c => c.state === 'visible' && !c.isMain)
        if (candidates.length === 0) return

        // 挑選一張隨機照片晉升
        const target = candidates[Math.floor(Math.random() * candidates.length)]
        isPromotingMain.value = true

        const viewport = { width: window.innerWidth, height: window.innerHeight }

        // 重新計算其佈局 (改為 isMain 模式)
        refreshSeed()
        const newLayout = computeCardLayout(target.photo, cardIdCounter, viewport, [], true)

        // 套用新佈局
        target.isMain = true
        target.x = newLayout.x
        target.y = newLayout.y
        target.displayWidth = newLayout.displayWidth
        target.displayHeight = newLayout.displayHeight
        target.rotate = newLayout.rotate
        target.filterClass = newLayout.filterClass // 會變回彩色

        // z-index 提到最高
        const maxZ = visibleCards.value.reduce((m, c) => Math.max(m, c.zIndex % 10000), 0)
        target.zIndex = 10000 + maxZ + 1

        setTimeout(() => {
            isPromotingMain.value = false
        }, 1500) // 配合 CSS transition 加點緩衝
    }

    // ── 讀取照片 ──
    async function loadFolder(folderPath: string) {
        isLoading.value = true
        loadProgress.value = 0
        error.value = null

        try {
            loadProgress.value = 20
            const photos = await invoke<PhotoInfo[]>('scan_folder', { folderPath })
            loadProgress.value = 90

            if (photos.length === 0) {
                error.value = '此資料夾中沒有找到圖片檔案'
                isLoading.value = false
                return
            }

            allPhotos.value = photos
            photoIndex = 0
            loadProgress.value = 100

            setTimeout(() => {
                isLoading.value = false
                hasLoaded.value = true
                startWall()
            }, 500)
        } catch (e) {
            error.value = `載入失敗：${e}`
            isLoading.value = false
        }
    }

    async function loadDefaultFolder() {
        // 1. 先嘗試從本地儲存載入
        const hasSaved = loadFromStorage()

        if (hasSaved && settings.value.sourceFolder) {
            await loadFolder(settings.value.sourceFolder)
            return
        }

        // 2. 若無紀錄，嘗試系統預設目錄
        try {
            const defaultDir = await invoke<string>('get_default_photos_dir')
            settings.value.sourceFolder = defaultDir
            saveToStorage()
            await loadFolder(defaultDir)
        } catch {
            error.value = '請選擇一個包含照片的資料夾'
        }
    }

    async function chooseFolderAndLoad() {
        try {
            const selected = await open({
                directory: true,
                multiple: false,
                title: '選擇照片資料夾',
            })
            if (selected && typeof selected === 'string') {
                settings.value.sourceFolder = selected
                saveToStorage()
                stopWall()
                visibleCards.value = []
                await loadFolder(selected)
            }
        } catch (e) {
            error.value = `無法開啟選擇視窗：${e}`
        }
    }

    // ── 播放順序管理 (確保不重複) ──
    const shuffledPhotos = ref<PhotoInfo[]>([])
    let currentShuffledIndex = 0

    function shufflePhotos() {
        const photos = [...allPhotos.value]
        // Fisher-Yates Shuffle
        for (let i = photos.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [photos[i], photos[j]] = [photos[j], photos[i]]
        }
        shuffledPhotos.value = photos
        currentShuffledIndex = 0
    }

    // ── 下一張照片 ──
    function nextPhoto(): PhotoInfo {
        if (allPhotos.value.length === 0) return allPhotos.value[0] // 應不發生

        // 如果是隨機模式，使用洗牌隊列
        if (settings.value.randomOrder) {
            if (currentShuffledIndex >= shuffledPhotos.value.length) {
                // 全部播過一輪了，重新洗牌
                shufflePhotos()
            }
            const photo = shuffledPhotos.value[currentShuffledIndex]
            currentShuffledIndex++
            return photo
        } else {
            // 順序播放模式
            const photo = allPhotos.value[photoIndex % allPhotos.value.length]
            photoIndex++
            return photo
        }
    }

    // ── 加入一張照片 ──
    async function addPhoto(delayAdd: boolean = false) {
        if (allPhotos.value.length === 0) return

        // 1. 如果是延遲模式，直接跳到新增邏輯
        if (!delayAdd) {
            const limit = settings.value.maxVisible
            const currentActive = visibleCards.value.filter(c => c.state !== 'leaving')

            // 如果超過數量上限，先觸發退場，並在 2.5 秒後再加入新照片
            if (currentActive.length >= limit) {
                const oldest = [...currentActive].sort((a, b) => a.zIndex % 10000 - b.zIndex % 10000)[0]
                if (oldest) {
                    oldest.state = 'leaving'

                    // 如果離開的是主照片，挑選一個現有的來「晉升」
                    if (oldest.isMain) {
                        promoteNextMain()
                    }

                    // 退場動畫總長 5s，我們在中間點 (2.5s) 加入新照片
                    setTimeout(() => {
                        addPhoto(true)
                    }, 2500)

                    // 5s 後徹底從 DOM 移除
                    setTimeout(() => {
                        visibleCards.value = visibleCards.value.filter(c => c.id !== oldest.id)
                    }, 5000)
                    return
                }
            }
        }

        const photo = nextPhoto()
        const viewport = { width: window.innerWidth, height: window.innerHeight }

        cardIdCounter++
        refreshSeed()

        // 隨需載入高品質縮圖 (加上簡易快取)
        const thumbnailCache = (window as any)._photoThumbnailCache || new Map<string, string>();
        (window as any)._photoThumbnailCache = thumbnailCache;

        let thumbnail = thumbnailCache.get(photo.path)
        if (!thumbnail) {
            try {
                thumbnail = await invoke<string>('request_thumbnail', { path: photo.path })
                thumbnailCache.set(photo.path, thumbnail)
            } catch (e) {
                console.error('Failed to load thumbnail', e)
                // 失敗則排程下一張
                addTimer = setTimeout(() => addPhoto(true), 2000)
                return
            }
        }

        const currentActive = visibleCards.value.filter(c => c.state !== 'leaving')
        // 2. 判定是否需要產生主照片 (目前畫面中沒有主照片且沒人正在被晉升時)
        const hasMain = currentActive.some(c => c.isMain)
        const isMain = !hasMain && !isPromotingMain.value

        const { speed } = settings.value
        const layout = computeCardLayout(
            photo,
            cardIdCounter,
            viewport,
            visibleCards.value.filter(c => c.state !== 'leaving'),
            isMain
        )

        const card: PhotoCard = {
            ...layout,
            id: `card-${cardIdCounter}`,
            thumbnail, // 填入剛剛拿到的高品質縮圖
            state: 'entering',
            enterDelay: 0,
            kenBurns: settings.value.kenBurnsEnabled && layout.kenBurns,
        }

        // 新照片 z-index 計算：主照片給予極高基數確保在最上層
        const baseZ = visibleCards.value.reduce((m, c) => Math.max(m, c.zIndex % 10000), 0)
        card.zIndex = (isMain ? 10000 : 0) + baseZ + 1

        visibleCards.value.push(card)

        // 短暫後設為 visible
        setTimeout(() => {
            const found = visibleCards.value.find(c => c.id === card.id)
            if (found) found.state = 'visible'
        }, 50)

        // 排程下一張
        const interval = SPEED_MAP[speed].interval
        addTimer = setTimeout(addPhoto, interval)
    }

    // ── 啟動 / 停止 ──
    function startWall() {
        stopWall()
        visibleCards.value = []
        shufflePhotos() // 啟動時先洗好牌

        // 先快速加幾張初始照片，製造「照片已在桌上」的感覺
        const initialCount = Math.min(settings.value.maxVisible, allPhotos.value.length)
        for (let i = 0; i < initialCount; i++) {
            setTimeout(() => addPhoto(), i * 300)
        }
    }

    function stopWall() {
        if (addTimer) {
            clearTimeout(addTimer)
            addTimer = null
        }
    }

    function restartWall() {
        stopWall()
        visibleCards.value = []
        photoIndex = 0
        setTimeout(startWall, 100)
    }

    // ── 設定變更 ──
    function updateSettings(partial: Partial<AppSettings>) {
        settings.value = { ...settings.value, ...partial }
        saveToStorage()
    }

    // ── 清理 ──
    onUnmounted(() => {
        stopWall()
    })

    return {
        // 狀態
        allPhotos,
        visibleCards,
        settings,
        isLoading,
        loadProgress,
        hasLoaded,
        error,
        isRunning,
        // 方法
        loadFolder,
        loadDefaultFolder,
        chooseFolderAndLoad,
        startWall,
        stopWall,
        restartWall,
        updateSettings,
    }
}
