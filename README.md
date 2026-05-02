# Coworks 任務平台（超新手版）

這份說明是給「第一次碰程式」的人。
你只要照著做，就可以把網站跑起來。

## 這是什麼

這是一個任務管理網站，重點功能：
- 用 `MSSQL` 存資料
- 用 `LINE Login` 登入
- 支援 `內部帳號密碼` 登入（讀取公司內部 Login 資料表）
- 內部帳號可在登入後「綁定 LINE」成同一帳號
- 任務資料來自 `dbo.AR_LineProjectList`
- 任務可留言、可通知、可看到誰指派給誰
- 角色權限：`IsAdmin = 1` 可管理成員與全部任務/留言

## 先準備這 3 樣

1. 安裝 Node.js（建議 LTS 版本）
2. 可以連到 MSSQL
3. 有 LINE Login Channel（要拿到 ID 與 Secret）
4. MSSQL 內有 `[WIP].[dbo].[Login]`（至少含 `UserNo`, `U_Name`, `U_Pwd`；可加 `IsAdmin`）

## 第一次啟動（本機）

1. 開 PowerShell，進到專案資料夾

```powershell
cd "C:\path\to\coworks-task-board"
```

2. 安裝套件

```powershell
npm install
```

3. 建立 `.env`

```powershell
copy .env.example .env
```

4. 編輯 `.env`（至少要改下面幾個）

```env
PORT=4000
FRONTEND_URL=http://localhost:5173
JWT_SECRET=請改成你自己的密碼字串

MSSQL_HOST=你的資料庫主機
MSSQL_PORT=1433
MSSQL_DATABASE=你的資料庫名稱
MSSQL_USER=你的帳號
MSSQL_PASSWORD=你的密碼
MSSQL_ENCRYPT=false
MSSQL_TRUST_SERVER_CERTIFICATE=true

LINE_CHANNEL_ID=你的LINE_CHANNEL_ID
LINE_CHANNEL_SECRET=你的LINE_CHANNEL_SECRET
LINE_REDIRECT_URI=http://localhost:4000/api/auth/line/callback
```

5. 啟動

```powershell
npm run dev
```

6. 打開瀏覽器
- 前端：`http://localhost:5173`
- 後端健康檢查：`http://localhost:4000/api/health`

## LINE 登入成功的 3 個必要條件

1. `.env` 的 `FRONTEND_URL` 要等於你實際打開的網址
2. `.env` 的 `LINE_REDIRECT_URI` 要等於 `你的網址/api/auth/line/callback`
3. LINE Developers 後台的 Callback URL 要和第 2 點完全一樣

## 上 IIS（Windows）最簡流程

1. 建置前後端

```powershell
npm run build
```

2. 前端檔案放到 IIS 目錄（建議）

```powershell
robocopy "client\dist" "C:\inetpub\coworks" /MIR
```

3. IIS 新增網站
- Physical Path 設為 `C:\inetpub\coworks`
- App Pool 用 `No Managed Code`

4. IIS 必裝模組
- URL Rewrite
- ARR（Application Request Routing）
- 在 ARR 裡啟用 `Enable proxy`

5. 後端 API 要常駐執行

```powershell
node server\dist\index.js
```

正式環境建議用 NSSM 設為 Windows 服務，避免重開機後忘記啟動。

6. 正式環境 `.env` 範例

```env
NODE_ENV=production
PORT=4000
FRONTEND_URL=https://你的網域
UPLOAD_PUBLIC_BASE=https://你的網域/uploads
LINE_REDIRECT_URI=https://你的網域/api/auth/line/callback
```

> `UPLOAD_PUBLIC_BASE` 很重要：它決定前端顯示的附件網址。
> 如果前端是 IIS 靜態站、後端是另一個 Node 服務，請一定要用「可被瀏覽器直接存取」的完整網址（例如 `https://你的網域/uploads`）。

## 常見錯誤（直接對照）

### 1) `HTTP 500.19 (0x80070005)`
意思：IIS 沒權限讀 `web.config`。

解法：
- 不要放在 Desktop，改放 `C:\inetpub\...`
- 給 `IIS_IUSRS`、`IUSR`、`IIS APPPOOL\你的AppPool` 讀取權限

### 2) `HTTP 500.19 (0x8007000d)`
意思：`web.config` 格式或模組有問題。

解法：
- 安裝 URL Rewrite + ARR
- 確認 `web.config` 是正確 XML（本專案已提供）

### 3) 按 LINE 登入沒反應或一直失敗
最常見原因：
- `FRONTEND_URL` 還是 `localhost`
- `LINE_REDIRECT_URI` 還是 `localhost:4000`
- LINE Developers Callback URL 沒同步
- IIS ARR 把 `Location` header 改寫掉（請關閉 `Reverse rewrite host in response headers`）

### 4) `EADDRINUSE: 4000`
意思：4000 埠已被舊程式占用。

解法：
- 關掉舊的 Node 行程後再啟動

### 5) `Login failed for user`
意思：MSSQL 帳號或密碼不對，或 SQL Server 沒開 SQL 登入模式。

## 小提醒

- `.env` 有密碼，不要上傳到 Git。
- `node_modules`、`client/dist`、`server/dist` 都不用提交。
- 指定群組是 LINE 群組，不是固定寫死選單。
