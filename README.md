# 照片牆 (Photo Wall) - 復古沖印風格桌面應用

這是一款模擬「老式沖印照片隨意散落在桌面上」的視覺體驗應用，啟發自 Apple 螢幕保護程式。透過 Vue 3、TypeScript 與 Tauri (Rust) 打造，提供原生 macOS 的流暢與溫暖感。

## 📸 核心特性

- **復古視覺**：Polaroid 白色厚邊框、立體陰影、隨機散落角度。
- **動態故事感**：柔和的飄入/飄出動畫、Ken Burns 緩慢變焦效果。
- **智能佈局**：畫面始終維持一張「彩色主照片」置中，背景配以「黑白藝術照片」散落。
- **隨需處理**：專為大量照片（上千張）設計的平衡型架構，搭載 Rust 平行掃描與延遲載入技術。
- **自動修正**：內建 EXIF 方向識別，自動轉正手機拍歪的照片。

---

## 📅 開發過程總結 (2026-03-15)

### 1. 專案規劃與初始化
- 建立 Tauri v2 + Vue 3 專案。
- 引入 Quasar 框架並自定義 Noto Serif 與 DM Serif Display 字體。
- 實作「一主多從」的層級與濾鏡邏輯。

### 2. 遇到的技術挑戰與卡關處
- **Sass 編譯衝突**：初期因 macOS 版本限制無法使用 `sass-embedded`，經討論後改用相容性更好的 `sass` 並順利解決重載問題。
- **Tauri v2 權限變更**：遺漏了 v2 要求的 `fs:allow-read-dir` 權限關鍵字，導致掃描功能初期失效，後經修正 capabilities 配置解決。
- **Rust 庫名稱同步**：在修改 `Cargo.toml` 庫名稱後，`main.rs` 的引用未同步更新，導致編譯錯誤，現已修正。
- **相片方向問題**：發現手機拍攝的照片有翻轉異常，透過引入 `kamadak-exif` 解析照片元數據並在 Rust 層級自動轉正。
- **Release 編譯類型錯誤**：在產出正式版本時遇到 TypeScript 嚴格檢查，針對隨需載入架構修正了 `useLayout` 的類型定義，確保生產環境編譯順利。

### 4. 開發環境優化 (DX)
- **sccache 全域快取**：配置了 `sccache` 並將 `RUSTC_WRAPPER` 寫入 `~/.zshrc`。這能讓多個 Rust/Tauri 專案共用同一個編譯快取目錄，大幅節省硬碟空間並將重複編譯時間從幾分鐘降至幾秒鐘。

### 3. 用戶重要提問與應對
- **「上千張照片會有效能問題嗎？」**
  - **對策**：將掃描邏輯改為「Header-only」，僅讀取尺寸。實作「隨需請求縮圖 (On-demand Loading)」，只有要上場的照片才處理，極大節省記憶體與 CPU。
- **「桌面留存數是什麼？」**
  - **解答**：指螢幕上同時出現的照片堆疊厚度。系統會自動移除最舊的照片以維持此數量。
- **「黑白濾鏡會很耗電嗎？」**
  - **解答**：不會。我們啟用了 GPU 硬體加速與實作了 `will-change: filter` 優化，運算幾乎不佔用 CPU 資源。
- **「不想要重複的照片怎麼辦？」**
  - **解決方案**：實作了 **Fisher-Yates 洗牌演算法**，確保在每一輪照片播完前，不會看見重複的內容。

---

## 🛠️ 技術棧

- **Frontend**: Vue 3 (Composition API), TypeScript, Quasar, Vite.
- **Backend (Native)**: Rust, Tauri v2.
- **Image handling**: `image` (Rust), `kamadak-exif` (Metadata), `rayon` (Parallelism).
- **Build Tool**: `sccache` (Compilation Caching).

## 🚀 快速開始

```bash
# 安裝依賴
npm install

# 啟動開發者模式
npm run tauri dev

# 編譯正式版本 (Release)
npm run tauri build
```

## 🤖 給未來 AI 助手的提示

當您啟動新專案或對此專案進行維護時，請將以下指令提供給 AI 以延續最佳實踐：
> 「我已配置 `sccache` 環境，請優先使用。針對大量照片處理，請參考 `02_照片牆` 專案中的 **Parallel Scanning** 與 **On-demand Thumbnail Loading** 模式，以兼顧效能與節能。」

## 📜 授權協議

本專案採用 **MIT License**。
