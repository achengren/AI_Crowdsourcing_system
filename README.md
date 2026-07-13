# AI Crowdsourcing System

众包收集 AI 对话失败案例的平台。用户可以在此与多种 AI 模型对话，将不满意的回答提交到案例广场，供社区浏览、点赞和评论，以此发现和记录当前 AI 系统的不足之处。

## 功能

- **多模型 AI 对话** — 支持 DeepSeek 文本对话 + Qwen3-VL 视觉识图
- **案例提交** — 将 AI 未能满足需求的回答提交到广场，含平台、分类、满意度、标签、截图等
- **链接解析** — 自动提取 DeepSeek / ChatGPT / Claude / Kimi / 通义千问 分享链接中的对话内容
- **案例广场** — 浏览、搜索、按分类/热度筛选，点赞和评论
- **用户系统** — 学号注册登录、JWT 认证、游客模式，每人每日 5 条/每周 20 条提交限制

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Vue 3 + Vite + Ant Design Vue + Pinia |
| 后端 | Express + SQLite (sql.js) |
| AI | DeepSeek API + Ollama (Qwen3-VL-8B) |
| 安全 | JWT + bcrypt + DOMPurify XSS 防护 |

## 快速开始

```bash
# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 填入 DEEPSEEK_API_KEY

# 启动开发服务（前端 + 后端）
npm run dev
```

前端运行在 `http://localhost:5173`，后端 API 在 `http://localhost:3001`。

## 环境变量

```env
DEEPSEEK_API_KEY=your_deepseek_api_key
```

视觉识别功能依赖 Ollama 服务（`server/index.js` 中配置 `ollama` 客户端地址），需确保 Qwen3-VL 模型已部署。

## 目录结构

```
├── src/
│   ├── api/           # 前端 API 调用
│   ├── components/    # 公共组件（布局、侧边栏等）
│   ├── pages/
│   │   ├── Chat/      # 对话页
│   │   ├── Gallery/   # 案例广场
│   │   ├── Login/     # 登录注册
│   │   └── Profile/   # 个人中心
│   └── router/        # 路由配置
├── server/
│   ├── index.js       # Express 后端入口
│   ├── linkParser.js  # AI 分享链接解析
│   └── uploads/       # 上传图片目录
└── vite.config.js
```

## 数据库

SQLite，文件存储在 `server/data.db`。包含以下表：

- `users` — 用户（学号、姓名、密码哈希）
- `conversations` / `messages` — 对话历史
- `submissions` — 案例提交
- `likes` / `comments` — 点赞和评论

## API 概览

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/auth/register` | 注册 |
| POST | `/api/auth/login` | 登录 |
| GET/POST/DELETE | `/api/conversations` | 会话管理 |
| POST | `/api/chat/send` | 发送消息（支持图片） |
| POST | `/api/upload` | 上传图片 |
| POST | `/api/parse-link` | 解析 AI 分享链接 |
| POST | `/api/submissions` | 提交案例 |
| GET | `/api/cases` | 案例广场列表 |
| POST | `/api/cases/:id/like` | 点赞/取消 |
| GET/POST | `/api/cases/:id/comments` | 评论列表/发表 |
