import { DataSource } from 'typeorm';
import { faker, generateUUID, pickRandom, seedDate } from '../utils/helpers';
import { NotificationType } from '../../common/enums';

export interface SeededNotification {
  id: string;
  userId: string;
  type: NotificationType;
  isRead: boolean;
}

const NOTIFICATION_TEMPLATES: Record<NotificationType, { title: string; message: string }[]> = {
  [NotificationType.REGISTRATION_CONFIRMATION]: [
    { title: 'Înregistrare primită', message: 'Înregistrarea la {tournament} a fost primită și este în curs de examinare.' },
  ],
  [NotificationType.REGISTRATION_APPROVED]: [
    { title: 'Înregistrare aprobată!', message: 'Clubul tău a fost aprobat la {tournament}.' },
    { title: 'Bine ai venit la turneu', message: 'Vești bune! Echipa ta este înscrisă la {tournament}.' },
  ],
  [NotificationType.REGISTRATION_REJECTED]: [
    { title: 'Înregistrare respinsă', message: 'Din păcate, înregistrarea la {tournament} nu a fost aprobată.' },
  ],
  [NotificationType.TOURNAMENT_PUBLISHED]: [
    { title: 'Turneu nou disponibil', message: '{tournament} este acum deschis pentru înscrieri!' },
  ],
  [NotificationType.TOURNAMENT_CANCELLED]: [
    { title: 'Turneu anulat', message: '{tournament} a fost anulat. Verifică detaliile de rambursare.' },
  ],
  [NotificationType.TOURNAMENT_UPDATE]: [
    { title: 'Actualizare turneu', message: 'Există o actualizare pentru {tournament}. Verifică detaliile.' },
  ],
  [NotificationType.GROUP_DRAW]: [
    { title: 'Tragere la sorți finalizată', message: 'Tragerea la sorți pentru {tournament} este completă. Verifică grupa!' },
  ],
  [NotificationType.PAYMENT_REMINDER]: [
    { title: 'Reminder plată', message: 'Nu uita să finalizezi plata pentru {tournament}.' },
  ],
  [NotificationType.PAYMENT_COMPLETED]: [
    { title: 'Plată confirmată', message: 'Am primit plata de {amount} RON pentru {tournament}.' },
  ],
  [NotificationType.PAYMENT_FAILED]: [
    { title: 'Plată eșuată', message: 'Plata pentru {tournament} nu a putut fi procesată.' },
  ],
  [NotificationType.NEW_TOURNAMENT_MATCH]: [
    { title: 'Meci viitor', message: 'Următorul meci la {tournament} este programat. Verifică detaliile!' },
  ],
  [NotificationType.SYSTEM]: [
    { title: 'Notificare de sistem', message: 'Actualizare importantă a platformei. Te rugăm să verifici.' },
    { title: 'Bine ai venit!', message: 'Bine ai venit pe Platforma de Turnee! Începe prin a-ți crea clubul.' },
  ],
};

export async function seedNotifications(
  dataSource: DataSource,
  userIds: string[],
  tournamentNames: Map<string, string>,
): Promise<SeededNotification[]> {
  const notificationRepository = dataSource.getRepository('Notification');
  const seededNotifications: SeededNotification[] = [];
  const notificationTypes = Object.values(NotificationType);
  const tournamentNamesArray = Array.from(tournamentNames.values());

  for (const userId of userIds) {
    const count = faker.number.int({ min: 6, max: 10 });
    for (let i = 0; i < count; i++) {
      const notificationId = generateUUID();
      const type = pickRandom(notificationTypes);
      const templates = NOTIFICATION_TEMPLATES[type];
      const template = pickRandom(templates);

      const tournamentName = pickRandom(tournamentNamesArray) || 'Cupa Verii 2026';
      const title = template.title;
      const message = template.message
        .replace('{tournament}', tournamentName)
        .replace('{amount}', String(faker.number.int({ min: 200, max: 2000 })));

      const isRead = Math.random() > 0.4;

      await notificationRepository.insert({
        id: notificationId,
        user: { id: userId },
        type,
        title,
        message,
        isRead,
        sendEmailNotification: Math.random() > 0.3,
        emailSent: Math.random() > 0.5,
        metadata: { tournamentName, generatedAt: new Date().toISOString() },
        createdAt: seedDate(),
      });

      seededNotifications.push({ id: notificationId, userId, type, isRead });
    }
  }

  console.log(`✅ Seeded ${seededNotifications.length} notifications`);
  return seededNotifications;
}
