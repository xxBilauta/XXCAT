# XXCAT

喵日子：行事曆、手帳、健康、收支、照片與韓文學習。

網站：https://xxbilauta.github.io/XXCAT/

## GitHub Pages 部署

網站檔案位於 `app/neko-days/dist/`。GitHub Pages 的 Source 使用 **GitHub Actions**；`.github/workflows/pages.yml` 會檢查 JavaScript、執行既有測試，再將此目錄發布至網站根目錄。

更新 `main` 分支的網站檔案後會自動部署，也可在 Actions 手動執行 **Deploy XXCAT to GitHub Pages**。請勿將 Source 改回 `main / (root)`，否則只會顯示此 README。
