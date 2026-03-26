const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Optional: simple helper to ensure disconnection on process termination
process.on('SIGINT', async () => {
  try {
    await prisma.$disconnect();
  } finally {
    process.exit(0);
  }
});

module.exports = prisma;
