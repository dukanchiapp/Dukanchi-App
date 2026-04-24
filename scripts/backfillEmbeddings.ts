import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { embedProductBatch } from '../src/services/geminiEmbeddings';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting embedding backfill...');
  
  let totalProcessed = 0;
  const batchSize = 100;
  
  while (true) {
    const products = await prisma.$queryRawUnsafe<any[]>(`
      SELECT id, "productName" AS name, description, category 
      FROM "Product" 
      WHERE embedding IS NULL 
      LIMIT $1
    `, batchSize);

    if (products.length === 0) {
      break;
    }

    console.log(`Processing batch of ${products.length} products...`);
    await embedProductBatch(products);
    
    totalProcessed += products.length;
    console.log(`Total processed: ${totalProcessed}`);
    
    // Small delay to prevent hitting Gemini rate limits too aggressively
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log(`Backfill complete. Total products processed: ${totalProcessed}`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
