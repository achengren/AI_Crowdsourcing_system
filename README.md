# AI Crowdsourcing System

众包收集 AI 对话失败案例的平台。用户可以在此与多种 AI 模型对话，将不满意的回答提交到案例广场，供社区浏览、点赞和评论，以此发现和记录当前 AI 系统的不足之处。

## 功能

- **多模型 AI 对话** — DeepSeek 主对话 + Qwen3-VL 视觉识图 + Llama3.1 自动标题生成
- **案例提交** — 将 AI 未能满足需求的回答提交到广场，含平台、分类、满意度、标签、截图等
- **链接解析** — 自动提取 DeepSeek / ChatGPT / Claude / Kimi / 通义千问 分享链接中的对话内容
- **案例广场** — 浏览、搜索、按分类/热度筛选，点赞和评论
- **用户系统** — 学号注册登录、JWT 认证、游客模式，每人每日 5 条/每周 20 条提交限制

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Vue 3 + Vite + Ant Design Vue + Pinia |
| 后端 | Express 5 + SQLite (sql.js) |
| AI | DeepSeek API + Ollama |
| 安全 | JWT + bcrypt + DOMPurify XSS 防护 |

## AI 模型路由

| 场景 | 模型 | 提供商 | 说明 |
|---|---|---|---|
| 主对话 | `deepseek-chat` | DeepSeek API | 高质量文本生成 |
| 视觉识图 | `qwen3-vl:8b` | Ollama | 图片理解、OCR |
| 标题生成 | `llama3.1:8b` | Ollama | 新会话自动摘要 |

## 快速开始

```bash
# 安装依赖
npm install

# 配置环境变量
echo "DEEPSEEK_API_KEY=sk-xxx" > .env

# 启动开发服务（前端 + 后端）
npm run dev
```

前端 `http://localhost:5173`，后端 `http://localhost:3001`。

## 环境变量

```env
DEEPSEEK_API_KEY=your_deepseek_api_key
```

视觉识图和标题生成依赖 Ollama 服务，地址及模型名在 `server/config.js` 中配置。

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
