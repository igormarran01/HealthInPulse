require('dotenv').config();
const http = require('http');
const app  = require('./app');
const { initSocket } = require('./config/socket');
const prisma = require('./config/database');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);

// Inicializa Socket.io no mesmo servidor HTTP
initSocket(server);

const start = async () => {
  try {
    // Testa a conexão com o banco antes de subir
    await prisma.$connect();
    logger.info('✅ Banco de dados conectado');

    server.listen(PORT, () => {
      logger.info(`🚀 Servidor rodando na porta ${PORT} [${process.env.NODE_ENV || 'development'}]`);
    });
  } catch (err) {
    logger.error('❌ Falha ao iniciar o servidor:', err);
    process.exit(1);
  }
};

// Graceful shutdown
const shutdown = async (signal) => {
  logger.info(`${signal} recebido — encerrando...`);
  server.close(async () => {
    await prisma.$disconnect();
    logger.info('Servidor encerrado com sucesso');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

start();
