import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export const getDatabaseConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => {
  const databaseUrl = configService.get<string>('databaseUrl');
  const nodeEnv = configService.get<string>('nodeEnv');

  // If DATABASE_URL is provided, use it
  if (databaseUrl) {
    // Detect database type from URL
    const isPostgres = databaseUrl.startsWith('postgres');

    // Disable SSL for test environment (GitHub Actions PostgreSQL doesn't support SSL)
    const sslConfig =
      isPostgres && nodeEnv !== 'test' ? { rejectUnauthorized: false } : false;

    return {
      type: isPostgres ? 'postgres' : 'mysql',
      url: databaseUrl,
      entities: [__dirname + '/../**/*.entity{.ts,.js}'],
      synchronize: nodeEnv !== 'production',
      logging: nodeEnv === 'development',
      autoLoadEntities: true,
      ssl: sslConfig,
    };
  }

  // Fallback to individual DB_ variables (MySQL)
  return {
    type: 'mysql',
    host: configService.get<string>('database.host') || 'localhost',
    port: configService.get<number>('database.port') || 3306,
    username: configService.get<string>('database.username') || '',
    password: configService.get<string>('database.password') || '',
    database:
      configService.get<string>('database.database') || 'football_tournament',
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    synchronize: nodeEnv !== 'production',
    logging: nodeEnv === 'development',
    autoLoadEntities: true,
    charset: 'utf8mb4',
    timezone: 'Z',
  };
};
