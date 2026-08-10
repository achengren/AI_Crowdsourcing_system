# HIB课程管理系统

面向课程教学的 AI 错误案例与信息需求记录平台。账号由管理员统一创建，学生可完成 AI 对话、片段批注、案例提交和每日信息需求日记；管理员负责账号管理、案例管理、数据查看与导出。

## 主要功能

- 统一账号登录，无游客模式和自主注册；账号和密码由管理员发放
- DeepSeek 文本对话、Ollama 回退，以及 Qwen 读图后交由 DeepSeek 生成最终回复的视觉流水线
- 对话按 token 预算保留近期上下文，较早内容自动摘要并持久化；图片解析按图片哈希和视觉模型缓存
- 支持公开分享链接、复制粘贴完整对话、Qwen 识别连续对话截图和手动填写四种案例导入方式
- 每条站内 AI 回复均可独立进行 1–5 星满意度评分，评分与案例提交互不依赖
- 独立案例编辑页同时展示原始对话和案例表单，支持服务端自动保存、手动保存及多份草稿；从案例广场可选择继续指定草稿或新建案例
- 案例采用“错误类型、知识场景、来源问题”三维多选分类；任一维度选择“其他”时必须填写具体说明；选中 AI 回复片段添加错误类型和批注，批注提交后不可修改
- 案例详情分为上方“补充批注”和下方“批注讨论”；每条批注作为独立讨论帖，可投赞成票、反对票、发表评论或回复评论；长评论可折叠，有回复的评论删除后保留讨论上下文
- 站内 AI 对话记录持续保留，学生不能自行删除
- 对话转案例时由服务端锁定原始平台、模型和回复
- 新案例发布后立即进入案例广场；管理员可填写原因后撤回，也可恢复误撤回的案例，所有操作保留审计记录
- 每日信息需求日记、GenAI 标记和日记转案例
- 管理员账号 CRUD、批量导入、全部状态案例管理、按日期检查每位学生的作业完成度、对话/日记查看、XLSX 导出和审计日志
- MySQL 持久化、应用级最小权限账号和 AI 并发保护
- 本地磁盘或 S3 兼容对象存储，支持 Docker 云端部署

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Vue 3、Vite、Ant Design Vue、Pinia |
| 后端 | Node.js 22、Express 5 |
| 数据库 | MySQL 8、mysql2、SQL migrations |
| AI | DeepSeek API、Ollama、OpenAI 兼容协议 |
| 安全 | JWT、bcrypt、后端 RBAC、Zod 校验、审计日志 |
| 文件 | 本地磁盘或 S3 兼容对象存储 |

## AI 路由

| 场景 | 默认模型 | 说明 |
|---|---|---|
| 主文本对话 | `DEEPSEEK_MODEL` | 显式关闭 thinking；无 API Key 时回退至 Ollama |
| 标题与质量评估 | `TITLE_MODEL` | Ollama 文本任务 |
| 图片问答 | `VISION_MODEL` → `DEEPSEEK_MODEL` | 视觉模型提取图片信息，DeepSeek 结合会话上下文生成最终回复 |

Ollama 地址和所有模型名称必须通过环境变量配置，源码和示例文件不包含实际部署值。

## 本地开发

要求 Node.js 22 和 MySQL 8。

```powershell
npm install
Copy-Item .env.example .env
```

编辑 `.env`：

- `DB_ADMIN_PASSWORD`：现有 MySQL root 密码，仅供首次初始化使用
- `DB_PASSWORD`：新建的低权限应用账号密码
- `JWT_SECRET`：至少 32 位随机字符串，不得与数据库密码复用
- `ADMIN_PASSWORD`：平台初始管理员的网页登录密码
- `DEEPSEEK_API_KEY`：使用 DeepSeek 时填写
- `DEEPSEEK_MODEL`：DeepSeek 文本模型名称
- `OLLAMA_BASE_URL`：Ollama 的 OpenAI 兼容接口地址，以 `/v1` 结尾
- `OLLAMA_TEXT_MODEL`：无 DeepSeek Key 时使用的文本模型
- `VISION_MODEL`：负责读取图片的视觉模型
- `TITLE_MODEL`：负责标题和质量评估的轻量文本模型
- `AI_CONTEXT_TOKEN_BUDGET`：单次回答使用的近似上下文 token 预算
- `AI_TEXT_TIMEOUT_MS` / `AI_VISION_TIMEOUT_MS`：文本回答与图片识别的独立超时
- `AI_TEXT_MAX_RETRIES` / `AI_VISION_MAX_RETRIES`：文本回答与图片识别的独立重试次数

初始化项目数据库与低权限账号：

```powershell
npm run db:provision
```

成功后应清空本机 `.env` 中的 `DB_ADMIN_PASSWORD`。后端日常运行只使用 `DB_USER` 和 `DB_PASSWORD`。

从旧版 `server/data.db` 导入历史数据时执行一次：

```powershell
npm run db:import-sqlite
```

启动前后端：

```powershell
npm run dev
```

- 前端：`http://localhost:5173`
- 后端健康检查：`http://localhost:3001/api/health`
- 管理后台：管理员登录后访问 `/admin`

## 账号管理

系统不提供注册和游客入口。初始管理员由 `ADMIN_STUDENT_ID`、`ADMIN_NAME`、`ADMIN_PASSWORD` 创建；管理员随后在后台新增或批量导入学生账号。管理员创建或重置密码后，用户可直接登录使用，也可在个人主页主动修改密码。

CSV/XLSX 导入支持以下列名：`studentId`/`学号`/`账号`、`name`/`姓名`、`password`/`初始密码`、`role`/`角色`、`className`/`班级`。

## 文件存储

本地默认配置：

```env
STORAGE_DRIVER=local
```

图片写入 `server/uploads/`。云端建议配置 S3、MinIO、Cloudflare R2 或其他 S3 兼容服务：

```env
STORAGE_DRIVER=s3
S3_REGION=auto
S3_ENDPOINT=https://your-s3-endpoint.example.com
S3_BUCKET=ai-crowdsourcing
S3_ACCESS_KEY_ID=replace-me
S3_SECRET_ACCESS_KEY=replace-me
S3_FORCE_PATH_STYLE=false
S3_KEY_PREFIX=uploads
```

应用始终通过需要登录的 `/uploads/...` 路径读取图片，S3 Bucket 应保持私有。仅迁移旧版公开 S3 URL 时才需要临时配置 `S3_PUBLIC_BASE_URL`。生产环境默认使用带 `Secure` 的 HttpOnly 会话 Cookie，因此域名必须启用 HTTPS；仅在封闭的 HTTP 测试环境中设置 `AUTH_COOKIE_SECURE=false`。

## Docker 部署

服务器需安装 Docker Engine 和 Compose 插件。

```bash
cp .env.production.example .env.production
# 编辑所有密码、域名、AI 与存储配置
docker compose --env-file .env.production -f docker-compose.production.yml up -d --build
```

容器会等待 MySQL 健康后启动，应用启动时自动执行数据库迁移，并由 Express 托管 `dist/` 前端文件。对公网服务时应在 3001 端口前配置 Nginx/Caddy、HTTPS、请求体限制和访问日志，不要直接暴露 MySQL 3306 端口。

生产环境不应把 `.env.production` 提交到 Git。初始管理员创建成功后，可从部署环境删除 `ADMIN_PASSWORD`。

## 云端迁移与备份

1. 在本机使用 `mysqldump -u ai_crowdsourcing -p ai_crowdsourcing > ai_crowdsourcing.sql` 导出。
2. 将 SQL 文件通过受保护的通道传到服务器。
3. 在云端 MySQL 使用 `mysql -u ai_crowdsourcing -p ai_crowdsourcing < ai_crowdsourcing.sql` 导入。
4. 本地存储模式还需迁移 `server/uploads/`；如果已使用 S3，无需复制应用磁盘文件。
5. 验证 `/api/health`、用户数量、对话数量、案例数量和管理员登录后再切换域名。

建议至少每日执行 MySQL 自动备份，并为对象存储开启版本控制或生命周期策略。备份必须定期做恢复演练，仅有备份文件不等于可恢复。

## 容量配置

当前默认面向约 100 名课程用户：MySQL 连接池为 15，AI 全局并发为 25，每用户 AI 并发为 2。部署到云端后应根据模型延迟、CPU/内存、数据库连接数和实际峰值调整 `DB_POOL_SIZE`、`AI_MAX_CONCURRENCY`、`AI_MAX_PER_USER`。

## 常用命令

```bash
npm run dev                # 前后端开发服务
npm run server             # 仅后端
npm run build              # 前端生产构建
npm run db:provision       # 一次性创建本地数据库和低权限账号
npm run db:import-sqlite   # 一次性导入旧 SQLite 数据
```

## API 概览

| 路径 | 说明 |
|---|---|
| `/api/auth/login`、`/api/auth/change-password` | 登录与改密 |
| `/api/conversations`、`/api/chat` | 对话、标题重命名、消息与逐条回复评分 |
| `/api/submissions`、`/api/cases` | 案例草稿、直接发布和广场互动 |
| `/api/diaries` | 信息需求日记 |
| `/api/admin` | 管理员账号、数据查看、案例撤回/恢复和导出 |
| `/api/upload` | 本地或 S3 图片上传 |
| `/api/health` | 数据库与 AI 并发状态 |
