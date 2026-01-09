import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { addDefaultColorsToClubs } from './migrations/add-default-colors';
import { DataSource } from 'typeorm';

async function runMigration() {
  const app = await NestFactory.create(AppModule);
  const dataSource = app.get(DataSource);

  console.log('Running migration: Add default colors to clubs...\n');
  
  try {
    await addDefaultColorsToClubs(dataSource);
    console.log('\n✓ Migration completed successfully!');
  } catch (error) {
    console.error('\n✗ Migration failed:', error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

runMigration();
