import { DataSource } from 'typeorm';
import {
  generateUUID,
} from '../utils/helpers';
import { Language } from '../../common/enums';

/**
 * Seed translations – RO + EN pairs for a handful of common UI keys
 * and some tournament-specific translated fields.
 */
export async function seedTranslations(
  dataSource: DataSource,
  tournaments: { id: string; name: string }[],
): Promise<number> {
  const repo = dataSource.getRepository('Translation');

  const UI_KEYS: { key: string; en: string; ro: string }[] = [
    { key: 'nav.home', en: 'Home', ro: 'Acasă' },
    { key: 'nav.tournaments', en: 'Tournaments', ro: 'Turnee' },
    { key: 'nav.clubs', en: 'Clubs', ro: 'Cluburi' },
    { key: 'nav.registrations', en: 'Registrations', ro: 'Înscrieri' },
    { key: 'nav.notifications', en: 'Notifications', ro: 'Notificări' },
    { key: 'nav.payments', en: 'Payments', ro: 'Plăți' },
    { key: 'nav.profile', en: 'Profile', ro: 'Profil' },
    { key: 'nav.settings', en: 'Settings', ro: 'Setări' },
    { key: 'btn.save', en: 'Save', ro: 'Salvează' },
    { key: 'btn.cancel', en: 'Cancel', ro: 'Anulează' },
    { key: 'btn.submit', en: 'Submit', ro: 'Trimite' },
    { key: 'btn.register', en: 'Register', ro: 'Înscrie-te' },
    { key: 'status.pending', en: 'Pending', ro: 'În așteptare' },
    { key: 'status.approved', en: 'Approved', ro: 'Aprobat' },
    { key: 'status.rejected', en: 'Rejected', ro: 'Respins' },
    { key: 'status.completed', en: 'Completed', ro: 'Finalizat' },
    { key: 'tournament.groups', en: 'Groups', ro: 'Grupe' },
    { key: 'tournament.draw', en: 'Draw', ro: 'Tragere la sorți' },
    { key: 'tournament.regulations', en: 'Regulations', ro: 'Regulament' },
    { key: 'tournament.schedule', en: 'Schedule', ro: 'Program' },
  ];

  let count = 0;

  // 1. UI-level keys (no entity binding)
  for (const k of UI_KEYS) {
    await repo.insert({ id: generateUUID(), key: k.key, language: Language.EN, value: k.en });
    await repo.insert({ id: generateUUID(), key: k.key, language: Language.RO, value: k.ro });
    count += 2;
  }

  // 2. Tournament name/description translations (first 20 tournaments)
  const slice = tournaments.slice(0, 20);
  for (const t of slice) {
    // Name translation
    await repo.insert({
      id: generateUUID(),
      key: `tournament.${t.id}.name`,
      language: Language.RO,
      value: t.name,
      entityType: 'tournament',
      entityId: t.id,
      field: 'name',
    });
    await repo.insert({
      id: generateUUID(),
      key: `tournament.${t.id}.name`,
      language: Language.EN,
      value: t.name.replace('Cupa', 'Cup').replace('Turneul', 'Tournament'),
      entityType: 'tournament',
      entityId: t.id,
      field: 'name',
    });
    count += 2;
  }

  console.log(`✅ Seeded ${count} translations`);
  return count;
}
