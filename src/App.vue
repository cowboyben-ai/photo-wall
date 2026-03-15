<template>
  <div class="photo-wall-container">
    <!-- 1. 背景木紋 -->
    <div class="bg-wood"></div>

    <!-- 2. 照片牆渲染層 -->
    <div class="wall-area">
      <div
        v-for="card in visibleCards"
        :key="card.id"
        class="photo-card"
        :class="[card.state, card.filterClass]"
        :style="{
          left: `${card.x}px`,
          top: `${card.y}px`,
          zIndex: card.zIndex,
          '--card-rotate': `rotate(${card.rotate}deg)`,
          '--drift-x': (card.x % 20 - 10) + 'px',
          '--drift-y': (card.y % 20 - 10) + 'px',
          transform: `rotate(${card.rotate}deg)`,
          animation: card.state === 'entering' 
            ? 'floatIn 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards' 
            : card.state === 'leaving'
            ? 'floatOut 5s ease-in-out forwards'
            : 'none'
        }"
        @click="zoomPhoto = card"
      >
        <div class="photo-frame">
          <div 
            class="photo-img-wrapper" 
            :style="{ width: `${card.displayWidth}px`, height: `${card.displayHeight}px` }"
          >
            <div :class="{ 'ken-burns-wrapper': card.kenBurns }">
              <img 
                :src="card.thumbnail" 
                class="photo-img" 
                :class="{ 'ken-burns-inner': card.kenBurns }"
              />
            </div>
          </div>
          <div v-if="settings.showCaption" class="photo-caption">
            {{ card.photo.filename.split('.')[0] }}
          </div>
        </div>
      </div>
    </div>

    <!-- 3. 空白狀態 -->
    <transition name="fade">
      <div v-if="hasLoaded && allPhotos.length === 0" class="empty-state">
        <q-icon name="photo_library" class="empty-icon" />
        <div class="empty-title">桌面空空如也</div>
        <div class="empty-desc">
          點擊右上方設定圖示，<br />
          選擇一個包含照片的資料夾開始播映
        </div>
        <q-btn
          flat
          label="選擇資料夾"
          color="amber-8"
          class="q-mt-md"
          @click="chooseFolderAndLoad"
        />
      </div>
    </transition>

    <!-- 4. 控制面板 -->
    <div class="control-panel">
      <button class="control-toggle-btn" @click="showSettings = !showSettings">
        <q-icon :name="showSettings ? 'close' : 'settings'" size="24px" />
      </button>

      <transition name="slide-fade">
        <div v-if="showSettings" class="settings-panel">
          <div class="panel-title">照片牆設定</div>

          <!-- 照片來源 -->
          <div class="setting-item">
            <div class="setting-label">
              <q-icon name="folder" size="14px" />
              照片來源
            </div>
            <div class="row items-center no-wrap">
              <div class="text-caption text-grey-5 ellipsis col">
                {{ settings.sourceFolder || '尚未選擇' }}
              </div>
              <q-btn
                flat
                round
                dense
                size="sm"
                icon="edit"
                color="amber-7"
                @click="chooseFolderAndLoad"
              />
            </div>
          </div>

          <q-separator dark class="q-my-md" style="opacity: 0.1" />

          <!-- 播放速度 -->
          <div class="setting-item">
            <div class="setting-label">播放速度</div>
            <q-btn-toggle
              v-model="settings.speed"
              toggle-color="amber-9"
              flat
              dense
              :options="[
                { label: '慢', value: 'slow' },
                { label: '中', value: 'medium' },
                { label: '快', value: 'fast' }
              ]"
            />
          </div>

          <!-- 其他開關 -->
          <div class="setting-item row items-center justify-between">
            <div class="setting-label q-mb-none">顯示照片名稱</div>
            <q-toggle v-model="settings.showCaption" dense color="amber-8" />
          </div>

          <div class="setting-item row items-center justify-between">
            <div class="setting-label q-mb-none">Ken Burns 效果</div>
            <q-toggle v-model="settings.kenBurnsEnabled" dense color="amber-8" />
          </div>

          <div class="setting-item row items-center justify-between">
            <div class="setting-label q-mb-none">隨機播放</div>
            <q-toggle v-model="settings.randomOrder" dense color="amber-8" />
          </div>

          <!-- 同時顯示數量 -->
          <div class="setting-item">
            <div class="setting-label">桌面留存數量 ({{ settings.maxVisible }})</div>
            <q-slider
              v-model="settings.maxVisible"
              :min="3"
              :max="20"
              :step="1"
              label
              color="amber-8"
            />
          </div>

          <q-btn
            unelevated
            label="更新播映"
            class="full-width q-mt-md"
            color="amber-9"
            @click="restartWall"
          />
        </div>
      </transition>
    </div>

    <!-- 5. 載入營幕 -->
    <transition name="fade">
      <div v-if="isLoading" class="loading-screen">
        <div class="loading-title">Photo Wall</div>
        <div class="loading-subtitle">正在點收您的回憶...</div>
        <div class="loading-bar-bg">
          <div class="loading-bar-fill" :style="{ width: `${loadProgress}%` }"></div>
        </div>
      </div>
    </transition>

    <!-- 6. 點擊放大 Overlay -->
    <transition name="overlay">
      <div v-if="zoomPhoto" class="photo-overlay" @click="zoomPhoto = null">
        <transition name="overlay-img" appear>
          <div class="photo-overlay-inner" @click.stop>
            <div class="photo-overlay-frame">
              <img :src="zoomPhoto.thumbnail" class="photo-overlay-img" />
              <div class="photo-overlay-caption">
                {{ zoomPhoto.photo.filename }}
              </div>
            </div>
            <q-btn
              class="absolute-top-right q-mt-md q-mr-md"
              flat
              round
              color="white"
              icon="close"
              @click="zoomPhoto = null"
            />
          </div>
        </transition>
      </div>
    </transition>

    <!-- 底部狀態 -->
    <div class="status-bar" v-if="allPhotos.length > 0">
      <div class="status-text">
        正在播映：{{ settings.sourceFolder }}（共 {{ allPhotos.length }} 張照片）
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { usePhotoWall } from './composables/usePhotoWall'
import type { PhotoCard } from './types'

const {
  allPhotos,
  visibleCards,
  settings,
  isLoading,
  loadProgress,
  hasLoaded,
  chooseFolderAndLoad,
  loadDefaultFolder,
  restartWall
} = usePhotoWall()

const showSettings = ref(false)
const zoomPhoto = ref<PhotoCard | null>(null)

onMounted(async () => {
  // 啟動時嘗試讀取預設照片目錄
  await loadDefaultFolder()
})

</script>

<style>
/* 補丁：淡入淡出過渡 */
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.6s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

.photo-wall-container {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  position: relative;
}

.wall-area {
  position: absolute;
  inset: 0;
  perspective: 1000px;
}
</style>