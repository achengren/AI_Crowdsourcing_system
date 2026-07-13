import express from 'express'
import cors from 'cors'
import { initDb, saveDbNow } from './db.js'
import { PORT, UPLOADS_DIR } from './config.js'
import authRoutes from './routes/auth.route.js'
import conversationRoutes from './routes/conversations.route.js'
import chatRoutes from './routes/chat.route.js'
import uploadRoutes from './routes/upload.route.js'
import linkParseRoutes from './routes/linkParse.route.js'
import submissionRoutes from './routes/submissions.route.js'
import caseRoutes from './routes/cases.route.js'

const app = express()

app.use(cors())
app.use(express.json())
app.use('/uploads', express.static(UPLOADS_DIR))

app.use('/api/auth', authRoutes)
app.use('/api/conversations', conversationRoutes)
app.use('/api/chat', chatRoutes)
app.use('/api/upload', uploadRoutes)
app.use('/api/parse-link', linkParseRoutes)
app.use('/api/submissions', submissionRoutes)
app.use('/api/cases', caseRoutes)

initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`后端服务已启动: http://localhost:${PORT}`)
    console.log('请先注册账号再登录')
  })
})

process.on('SIGTERM', () => { saveDbNow(); process.exit(0) })
process.on('SIGINT',  () => { saveDbNow(); process.exit(0) })
