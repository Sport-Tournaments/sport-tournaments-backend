import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export const getDatabaseConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => ({
  type: 'mysql',
  host: configService.get<string>('database.host') || 'localhost',
  port: configService.get<number>('database.port') || 3306,
  username: configService.get<string>('database.username') || 'root',
  password: configService.get<string>('database.password') || 'password',
  database: configService.get<string>('database.database') || 'football_tournament',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  synchronize: configService.get<string>('nodeEnv') !== 'production',
  logging: configService.get<string>('nodeEnv') === 'development',
  autoLoadEntities: true,
  charset: 'utf8mb4',
  timezone: 'Z',
});
