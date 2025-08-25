export const config = {
  port: +(process.env.PORT || 8080),
  db: {
    host: process.env.DB_HOST || 'db',
    port: +(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || 'postgres',
    pass: process.env.DB_PASS || 'postgres',
    name: process.env.DB_NAME || 'materials',
    sync: (process.env.DB_SYNC || 'true') === 'true',
  },
  security: {
    apiKey: process.env.API_KEY || 'dev-api-key',
    jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  },
};
