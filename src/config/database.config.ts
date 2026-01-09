import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export const getDatabaseConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => {
  const databaseUrl = configService.get<string>('databaseUrl');
  const nodeEnv = configService.get<string>('nodeEnv');

  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL environment variable is required. Please set it to your PostgreSQL connection URL.',
    );
  }

  // Validate that it's a PostgreSQL URL
  if (
    !databaseUrl.startsWith('postgres://') &&
    !databaseUrl.startsWith('postgresql://')
  ) {
    throw new Error(
      'DATABASE_URL must be a PostgreSQL connection URL (starting with postgres:// or postgresql://)',
    );
  }

  // Parse URL to check for sslmode parameter
  const url = new URL(databaseUrl);
  const sslMode = url.searchParams.get('sslmode');

  // Determine SSL configuration
  let sslConfig: boolean | { rejectUnauthorized: boolean };

  if (nodeEnv === 'test') {
    // Disable SSL for test environment
    sslConfig = false;
  } else if (sslMode === 'disable' || sslMode === 'false') {
    // Explicitly disable SSL if specified in connection string
    sslConfig = false;
  } else {
    // Enable SSL but don't verify certificate (for self-signed certs)
    sslConfig = { rejectUnauthorized: false };
  }

  return {
    type: 'postgres',
    url: databaseUrl,
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    synchronize: nodeEnv !== 'production',
    logging: nodeEnv === 'development',
    autoLoadEntities: true,
    ssl: sslConfig,
  };
};
