/**
 * useLayout — 照片散落佈局演算法
 * 
 * 負責計算每張照片的位置、角度、尺寸，
 * 確保自然散落、有適當重疊、不過度擁擠。
 */

import { ref } from 'vue'
import type { PhotoCard, PhotoInfo } from '../types'


// 簡單但可重現的偽隨機
function seededRng(seed: number) {
    let s = seed
    return () => {
        s = (s * 1664525 + 1013904223) & 0xffffffff
        return (s >>> 0) / 0xffffffff
    }
}

export function useLayout() {
    const rngSeed = ref(Date.now())

    function computeCardLayout(
        photo: PhotoInfo,
        index: number,
        viewport: { width: number; height: number },
        existingCards: PhotoCard[],
        isMain: boolean = false
    ): Omit<PhotoCard, 'state' | 'enterDelay'> {
        const rng = seededRng(rngSeed.value + index * 31337)

        // 照片顯示尺寸 — 根據原始比例
        const baseSize = Math.min(viewport.width, viewport.height)

        // 1. 調整尺寸：主照片 70% 左右，其它 50% 左右
        const scaleFactor = isMain
            ? 0.65 + rng() * 0.1  // 65% ~ 75%
            : 0.45 + rng() * 0.1  // 45% ~ 55%

        const displayWidth = Math.round(baseSize * scaleFactor)
        const aspectRatio = photo.height > 0 ? photo.height / photo.width : 1
        const displayHeight = Math.round(displayWidth * aspectRatio)

        // 加上照片邊框後的實際佔用空間
        const BORDER = 14
        const BORDER_BOTTOM = 42
        const totalW = displayWidth + BORDER * 2
        const totalH = displayHeight + BORDER + BORDER_BOTTOM

        // --- 核心邏輯調整：如果是主照片，要置中 ---
        let bestX: number;
        let bestY: number;

        if (isMain) {
            // 置中位置
            bestX = (viewport.width - totalW) / 2;
            bestY = (viewport.height - totalH) / 2;

            // 輕微偏移，增加隨性感
            bestX += (rng() - 0.5) * 40;
            bestY += (rng() - 0.5) * 40;
        } else {
            // 可放置區域 (留邊)
            const margin = 20
            const maxX = viewport.width - totalW - margin
            const maxY = viewport.height - totalH - margin

            // 嘗試找到不太重疊的位置 (最多嘗試 100 次)
            bestX = margin + rng() * Math.max(maxX - margin, 0)
            bestY = margin + rng() * Math.max(maxY - margin, 0)
            let minOverlap = Infinity

            for (let attempt = 0; attempt < 100; attempt++) {
                const tryX = margin + rng() * Math.max(maxX - margin, 0)
                const tryY = margin + rng() * Math.max(maxY - margin, 0)

                let maxExistingOverlap = 0
                for (const card of existingCards) {
                    const overlapX = Math.max(0, Math.min(tryX + totalW, card.x + card.displayWidth + BORDER * 2) - Math.max(tryX, card.x))
                    const overlapY = Math.max(0, Math.min(tryY + totalH, card.y + card.displayHeight + BORDER + BORDER_BOTTOM) - Math.max(tryY, card.y))
                    const overlap = overlapX * overlapY
                    maxExistingOverlap = Math.max(maxExistingOverlap, overlap)
                }

                const overlapThreshold = totalW * totalH * 0.45
                if (maxExistingOverlap < overlapThreshold) {
                    bestX = tryX
                    bestY = tryY
                    break
                }
                if (maxExistingOverlap < minOverlap) {
                    minOverlap = maxExistingOverlap
                    bestX = tryX
                    bestY = tryY
                }
            }
        }

        // 旋轉角度
        const absAngle = isMain ? 1 + rng() * 4 : 5 + rng() * 15 // 主照片轉動極小 (1~5度)
        const rotate = (rng() < 0.5 ? 1 : -1) * absAngle

        // --- 視覺濾鏡調整：其它照片變成黑白 ---
        const filterClass = isMain ? 'filter-none' : 'filter-grayscale'

        // Ken Burns 機率 60%
        const kenBurns = rng() < 0.6

        return {
            id: `${photo.id}-${index}`,
            photo,
            x: bestX,
            y: bestY,
            rotate,
            zIndex: index + 1,
            displayWidth,
            displayHeight,
            filterClass,
            kenBurns,
            isMain,
        }
    }

    function refreshSeed() {
        rngSeed.value = Date.now()
    }

    return { computeCardLayout, refreshSeed }
}
