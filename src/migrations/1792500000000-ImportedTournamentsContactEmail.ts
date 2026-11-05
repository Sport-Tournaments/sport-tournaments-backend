import { MigrationInterface, QueryRunner } from 'typeorm';
import {
  IMPORTED_TOURNAMENT_CONTACT_EMAIL,
  IMPORTER_EMAIL_PATTERN,
} from '../modules/leads/crm.constants';

/**
 * Tournaments imported by our scrapers are owned by system accounts
 * (import.<source>@turnee-sportive.ro) and had no contact email, so the public
 * page offered the system account's address. Point them at our real inbox.
 */
export class ImportedTournamentsContactEmail1792500000000 implements MigrationInterface {
  name = 'ImportedTournamentsContactEmail1792500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "tournaments" t
          SET "contact_email" = $1
         FROM "users" u
        WHERE u."id" = t."organizer_id"
          AND u."email" LIKE $2
          AND (t."contact_email" IS NULL
               OR t."contact_email" = ''
               OR t."contact_email" LIKE $2)`,
      [IMPORTED_TOURNAMENT_CONTACT_EMAIL, IMPORTER_EMAIL_PATTERN],
    );
  }

  public async down(): Promise<void> {
    // Not reversible: the previous value was empty for these tournaments.
  }
}
