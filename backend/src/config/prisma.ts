import dns from 'dns';
import { PrismaClient } from '@prisma/client';

try {
  dns.setDefaultResultOrder('ipv4first');
} catch {
  // Ignore in older runtimes
}

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
