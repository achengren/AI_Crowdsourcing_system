# AI Crowdsourcing System

众包收集 AI 对话失败案例的平台。用户可以在此与多种 AI 模型对话，将不满意的回答提交到案例广场，供社区浏览、点赞和评论，以此发现和记录当前 AI 系统的不足之处。

## 功能

- **多模型 AI 对话** — Llama3.1 主对话 + Qwen3-VL 视觉识图，全部运行在本地 Ollama；保留 DeepSeek API 接入接口，可一键切换
- **案例提交** — 两种入口：对话中一键"提交为案例"（自动填入内容），或广场页粘贴分享链接解析后提交；含平台、分类、满意度、标签、截图等
- **链接解析** — 自动提取 DeepSeek / ChatGPT / Claude / Kimi / 通义千问 分享链接中的对话内容
- **AI 质量反馈** — 自动检测 AI 回复是否可能存在信息缺失，提示用户并提供"如何改进"建议和快捷提交入口
- **案例广场** — 浏览、搜索、按分类/热度筛选，点赞和评论
- **用户系统** — 学号注册登录、JWT 认证、游客模式，每人每日 5 条/每周 20 条提交限制

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Vue 3 + Vite + Ant Design Vue + Pinia |
| 后端 | Express 5 + SQLite (sql.js) |
| AI | Ollama（本地模型，无需 API Key）+ DeepSeek API 接口（预留，可切换） |
| 安全 | JWT + bcrypt + DOMPurify XSS 防护 |

## AI 模型路由

当前默认使用 Ollama 本地模型，无需配置 API Key 即可运行。项目保留完整 DeepSeek API 接入代码，切换方式见下方说明。

| 场景 | 模型 | 提供商 | 说明 |
|---|---|---|---|
| 主对话 | `llama3.1:8b` | Ollama 本地 | 文本生成与对话 |
| 视觉识图 | `qwen3-vl:8b` | Ollama 本地 | 图片理解、OCR |
| 标题生成/质量评估 | `llama3.1:8b` | Ollama 本地 | 自动摘要与回复质量检测 |

### 切换到 DeepSeek API

项目已预留 DeepSeek API 接入接口，未来用户规模增长后可切换以获得更好的并发与响应速度：

1. 设置环境变量 `DEEPSEEK_API_KEY=your_key`
2. 编辑 `server/services/chatService.js`，将 `sendTextMessage` 函数中的 `ollama` 改为 `deepseek`，`OLLAMA_TEXT_MODEL` 改为 `DEEPSEEK_MODEL`，并恢复 `import { deepseek, ollama }` 导入

模型名称和 API 地址在 `server/config.js` 中统一配置。

## 快速开始

```bash
# 安装依赖
npm install

# （可选）如需使用 DeepSeek API 替代本地模型
# echo "DEEPSEEK_API_KEY=sk-xxx" > .env

# 启动开发服务（前端 + 后端）
npm run dev
```

前端 `http://localhost:5173`，后端 `http://localhost:3001`。

> 默认使用 Ollama 本地模型，无需配置 API Key。确保 Ollama 服务已启动并部署了 `llama3.1:8b` 和 `qwen3-vl:8b` 两个模型。

## 环境变量

```env
# 可选：仅在使用 DeepSeek API 时需要
DEEPSEEK_API_KEY=your_deepseek_api_key
```

Ollama 服务地址及所有模型名称在 `server/config.js` 中配置。

## 备注

- **图片存储**：当前使用本地磁盘存储（`server/uploads/`），删除会话时同步清理关联图片。后期用户量增长后，建议迁移至对象存储（如阿里云 OSS、AWS S3），通过 presigned URL 上传和 CDN 分发，降低磁盘和管理成本。

## 目录结构

```
├── src/
│   ├── api/              # 前端 API 调用
│   ├── components/       # 公共组件（布局、侧边栏等）
│   ├── pages/
│   │   ├── Chat/         # 对话页
│   │   ├── Gallery/      # 案例广场
│   │   ├── Login/        # 登录注册
│   │   └── Profile/      # 个人中心
│   └── router/           # 路由配置
├── server/
│   ├── index.js          # 入口（路由挂载）
│   ├── config.js         # 常量配置
│   ├── ai.js             # AI 客户端（DeepSeek + Ollama）
│   ├── db.js             # SQLite 生命周期
│   ├── middleware.js      # 认证 + 上传中间件
│   ├── linkParser.js     # AI 分享链接解析
│   ├── routes/
│   │   ├── auth.route.js           # 注册/登录
│   │   ├── conversations.route.js  # 会话 CRUD
│   │   ├── chat.route.js           # AI 对话（文本+视觉）
│   │   ├── upload.route.js         # 图片上传
│   │   ├── linkParse.route.js      # 链接解析
│   │   ├── submissions.route.js    # 案例提交
│   │   └── cases.route.js          # 案例广场+点赞+评论
│   ├── services/
│   │   ├── chatService.js          # 对话逻辑（视觉/文本/标题）
│   │   └── submissionService.js    # 提交限制/统计
│   ├── utils/
│   │   └── image.js                # 图片/标签工具
│   └── uploads/           # 上传图片目录
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
