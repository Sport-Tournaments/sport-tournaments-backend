import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { join } from 'path';
import { config } from 'dotenv';
import { runSeeder } from './index';

// Load .env file
config();

async function bootstrap() {
  console.log('🔌 Connecting to database...');

  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error(
      '❌ DATABASE_URL environment variable is required. Please set it to your PostgreSQL connection URL.',
    );
    process.exit(1);
  }

  // Validate that it's a PostgreSQL URL
  if (
    !databaseUrl.startsWith('postgres://') &&
    !databaseUrl.startsWith('postgresql://')
  ) {
    console.error(
      '❌ DATABASE_URL must be a PostgreSQL connection URL (starting with postgres:// or postgresql://)',
    );
    process.exit(1);
  }

  console.log('📦 Using PostgreSQL via DATABASE_URL');

  // Parse URL to check for sslmode parameter
  const url = new URL(databaseUrl);
  const sslMode = url.searchParams.get('sslmode');

  // Determine SSL configuration
  let sslConfig: boolean | { rejectUnauthorized: boolean };

  if (process.env.NODE_ENV === 'test') {
    sslConfig = false;
  } else if (sslMode === 'disable' || sslMode === 'false') {
    sslConfig = false;
  } else {
    sslConfig = { rejectUnauthorized: false };
  }

  const dataSourceOptions = {
    type: 'postgres' as const,
    url: databaseUrl,
    entities: [join(__dirname, '../modules/**/entities/*.entity{.ts,.js}')],
    synchronize: true,
    logging: process.env.DATABASE_LOGGING === 'true',
    ssl: sslConfig,
  };

  const dataSource = new DataSource(dataSourceOptions);

  try {
    await dataSource.initialize();
    console.log('✅ Database connected');
    console.log('');

    await runSeeder(dataSource);

    await dataSource.destroy();
    console.log('🔌 Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    process.exit(1);
  }
}

bootstrap();
