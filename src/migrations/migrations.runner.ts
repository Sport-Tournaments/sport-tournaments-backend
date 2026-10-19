import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DataSource } from 'typeorm';

/** Arbitrary app-wide key for pg_try_advisory_lock. */
const MIGRATIONS_LOCK_KEY = 728_311_942;

/**
 * Runs pending data migrations after TypeORM has synchronized the schema.
 * Only one replica runs them (advisory lock), and a failure is logged rather
 * than thrown so it can never take the API down; the migration is retried on
 * the next start since it was not recorded.
 */
@Injectable()
export class MigrationsRunner implements OnApplicationBootstrap {
  private readonly logger = new Logger(MigrationsRunner.name);

  constructor(private readonly dataSource: DataSource) {}

  async onApplicationBootstrap(): Promise<void> {
    if (process.env.NODE_ENV === 'test') return;

    const lockRunner = this.dataSource.createQueryRunner();
    try {
      const [{ locked }] = (await lockRunner.query(
        'SELECT pg_try_advisory_lock($1) AS locked',
        [MIGRATIONS_LOCK_KEY],
      )) as { locked: boolean }[];
      if (!locked) {
        this.logger.log('Another instance is running migrations; skipping');
        return;
      }
      try {
        const ran = await this.dataSource.runMigrations({
          transaction: 'each',
        });
        for (const m of ran) this.logger.log(`Ran migration ${m.name}`);
      } finally {
        await lockRunner.query('SELECT pg_advisory_unlock($1)', [
          MIGRATIONS_LOCK_KEY,
        ]);
      }
    } catch (err) {
      this.logger.error(
        `Data migrations failed: ${(err as Error).message}`,
        (err as Error).stack,
      );
    } finally {
      await lockRunner.release();
    }
  }
}
