import 'dotenv/config'
import mysql from 'mysql2/promise'

const config = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  adminUser: process.env.DB_ADMIN_USER || 'root',
  adminPassword: process.env.DB_ADMIN_PASSWORD || '',
  database: process.env.DB_NAME || 'ai_crowdsourcing',
  appUser: process.env.DB_USER || 'ai_crowdsourcing',
  appPassword: process.env.DB_PASSWORD || '',
  appHost: process.env.DB_APP_HOST || '%',
}

function validateConfig() {
  if (!/^[a-zA-Z0-9_]+$/.test(config.database)) {
    throw new Error('DB_NAME may contain only letters, numbers, and underscores.')
  }
  if (!/^[a-zA-Z0-9_]+$/.test(config.appUser) || config.appUser.length > 32) {
    throw new Error('DB_USER must be 1-32 letters, numbers, or underscores.')
  }
  if (!config.appPassword || config.appPassword.length < 10) {
    throw new Error('DB_PASSWORD must contain at least 10 characters.')
  }
  if (!config.adminUser) {
    throw new Error('DB_ADMIN_USER is required.')
  }
  if (!config.appHost || /['"`;\\]/.test(config.appHost)) {
    throw new Error('DB_APP_HOST is invalid.')
  }
  if (config.adminUser === config.appUser) {
    throw new Error('DB_USER must be a dedicated non-admin account.')
  }
}

async function provision() {
  validateConfig()

  const connection = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.adminUser,
    password: config.adminPassword,
  })

  const database = connection.escapeId(config.database)
  const appAccount = `${connection.escape(config.appUser)}@${connection.escape(config.appHost)}`

  try {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS ${database} CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`
    )
    await connection.query(`CREATE USER IF NOT EXISTS ${appAccount} IDENTIFIED BY ?`, [config.appPassword])
    await connection.query(`ALTER USER ${appAccount} IDENTIFIED BY ?`, [config.appPassword])
    await connection.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, DROP, REFERENCES ON ${database}.* TO ${appAccount}`
    )
  } finally {
    await connection.end()
  }

  const verification = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.appUser,
    password: config.appPassword,
    database: config.database,
  })
  await verification.query('SELECT 1')
  await verification.end()

  console.log(`Database "${config.database}" and application account "${config.appUser}" are ready.`)
}

provision().catch(error => {
  console.error(`MySQL provisioning failed: ${error.message}`)
  process.exitCode = 1
})
