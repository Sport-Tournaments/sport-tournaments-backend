import { DataSource } from 'typeorm';

export async function addDataTestColumn(dataSource: DataSource) {
  const tableExists = await dataSource.query(
    `SELECT EXISTS (
      SELECT FROM information_schema.columns
      WHERE table_name = 'tournaments' AND column_name = 'data_test'
    )`,
  );
  const exists = tableExists[0]?.exists;

  if (!exists) {
    await dataSource.query(
      `ALTER TABLE "tournaments" ADD COLUMN "data_test" boolean NOT NULL DEFAULT false`,
    );
    console.log('✓ Added data_test column to tournaments table');
  }

  const result = await dataSource.query(
    `UPDATE "tournaments" SET "data_test" = true WHERE "data_test" = false`,
  );
  console.log(
    `✓ Set data_test = true for ${result[1]} existing tournament records`,
  );
}
