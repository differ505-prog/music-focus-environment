# OmniSonic

OmniSonic 是一個以 `Next.js App Router`、`Tailwind CSS`、`TypeScript` 與 `howler.js` 建構的沉浸式音樂網站，聚焦於低干擾播放、主題路線探索與無縫接續聆聽體驗。

## 功能特色

- 深色沉浸式主視覺與 glassmorphism 介面
- 5 筆 `110 BPM` Mock Data 素材卡片
- 可複選的 BPM 篩選器，保留未來擴充空間
- 全選 / 取消全選與批次下載操作
- 固定底部的全域播放器
- 使用 `howler.js` 實作連續播放與 `4.36` 秒 crossfade
- 所有互動元件均使用 `'use client'`

## 技術棧

- `Next.js 16`
- `React 19`
- `TypeScript`
- `Tailwind CSS 4`
- `howler.js`
- `lucide-react`

## 本機開發

```bash
npm install
npm run dev
```

本機預設可於 [http://localhost:3000](http://localhost:3000) 開啟。

## 品質驗證

```bash
npm run check
npm run build
```

## Git 初始化

```bash
git init
git branch -M main
git add .
git commit -m "feat: build music focus environment"
```

## 推送 GitHub

若已建立遠端倉庫：

```bash
git remote add origin https://github.com/<your-account>/music-focus-environment.git
git push -u origin main
```

若已安裝並登入 GitHub CLI：

```bash
gh repo create music-focus-environment --public --source=. --remote=origin --push
```

## 部署 Vercel

```bash
npm install -g vercel
vercel
vercel --prod
```
