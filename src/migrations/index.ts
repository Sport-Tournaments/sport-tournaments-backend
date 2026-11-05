import { SeedCrmLeads1792400000000 } from './1792400000000-SeedCrmLeads';
import { ImportedTournamentsContactEmail1792500000000 } from './1792500000000-ImportedTournamentsContactEmail';

/**
 * Data migrations, run in order after schema synchronize. Listed explicitly
 * (not globbed) because the build also emits .d.ts files next to them.
 */
export const migrations = [
  SeedCrmLeads1792400000000,
  ImportedTournamentsContactEmail1792500000000,
];
