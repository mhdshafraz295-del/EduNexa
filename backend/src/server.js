import dotenv from 'dotenv';
dotenv.config();

import app from './app.js';
import prisma from './config/prisma.js';

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    // Verify database connectivity
    await prisma.$connect();
    console.log('🔗 Successfully connected to MySQL database via Prisma ORM.');

    const server = app.listen(PORT, () => {
      console.log(`🚀 EduNexa Multi-Institute SaaS API running on http://localhost:${PORT}`);
    });

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use.`);
        console.error(`💡 Hint: Run 'npm run free-port' or use 'npm run dev' to automatically release the port.`);
        process.exit(1);
      }
      console.error('❌ Server listener error:', error);
      process.exit(1);
    });

    // Graceful Shutdown Support
    let isShuttingDown = false;
    const handleShutdown = async (signal) => {
      if (isShuttingDown) return;
      isShuttingDown = true;
      console.log(`\n🛑 Received ${signal}. Gracefully shutting down EduNexa API...`);

      server.close(async () => {
        try {
          await prisma.$disconnect();
          console.log('🔌 Database disconnected cleanly.');
        } catch (err) {
          console.error('Error disconnecting database:', err);
        }
        process.exit(0);
      });

      // Force exit timeout
      setTimeout(() => {
        console.error('⚠️ Forcing process shutdown after timeout.');
        process.exit(1);
      }, 5000).unref();
    };

    process.on('SIGINT', () => handleShutdown('SIGINT'));
    process.on('SIGTERM', () => handleShutdown('SIGTERM'));
    process.once('SIGUSR2', () => {
      handleShutdown('SIGUSR2');
    });
  } catch (error) {
    console.error('❌ Failed to start EduNexa backend server:', error);
    process.exit(1);
  }
}

startServer();
