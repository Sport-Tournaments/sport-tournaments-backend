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

  let dataSourceOptions: any;

  if (databaseUrl) {
    // Use DATABASE_URL
    const isPostgres = databaseUrl.startsWith('postgres');
    console.log(
      `📦 Using ${isPostgres ? 'PostgreSQL' : 'MySQL'} via DATABASE_URL`,
    );

    dataSourceOptions = {
      type: isPostgres ? 'postgres' : 'mysql',
      url: databaseUrl,
      entities: [join(__dirname, '../modules/**/entities/*.entity{.ts,.js}')],
      synchronize: true,
      logging: process.env.DATABASE_LOGGING === 'true',
      ssl: isPostgres ? { rejectUnauthorized: false } : undefined,
    };
  } else {
    // Fallback to individual env vars (MySQL)
    console.log('📦 Using MySQL via individual env variables');
    dataSourceOptions = {
      type: 'mysql',
      host: process.env.DB_HOST || '127.0.0.1',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      username: process.env.DB_USERNAME || 'root',
      password: process.env.DB_PASSWORD || 'password',
      database: process.env.DB_DATABASE || 'football_tournament',
      entities: [join(__dirname, '../modules/**/entities/*.entity{.ts,.js}')],
      synchronize: true,
      logging: process.env.DATABASE_LOGGING === 'true',
    };
  }

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
