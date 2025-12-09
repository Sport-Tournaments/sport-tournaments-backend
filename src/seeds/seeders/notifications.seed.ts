import { DataSource } from 'typeorm';
import { faker } from '@faker-js/faker';
import { generateUUID, pickRandom } from '../utils/helpers';
import { NotificationType } from '../../common/enums';

export interface SeededNotification {
  id: string;
  userId: string;
  type: NotificationType;
  isRead: boolean;
}

const NOTIFICATION_TEMPLATES: Record<NotificationType, { title: string; message: string }[]> = {
  [NotificationType.REGISTRATION_CONFIRMATION]: [
    { title: 'Registration Received', message: 'Your registration for {tournament} has been received and is pending review.' },
  ],
  [NotificationType.REGISTRATION_APPROVED]: [
    { title: 'Registration Approved!', message: 'Your club registration for {tournament} has been approved.' },
    { title: 'Welcome to the Tournament', message: 'Great news! Your team is registered for {tournament}.' },
  ],
  [NotificationType.REGISTRATION_REJECTED]: [
    { title: 'Registration Rejected', message: 'Unfortunately, your registration for {tournament} was not approved.' },
    { title: 'Registration Status Update', message: 'Your registration for {tournament} has been declined.' },
  ],
  [NotificationType.TOURNAMENT_PUBLISHED]: [
    { title: 'New Tournament Available', message: '{tournament} is now open for registration!' },
  ],
  [NotificationType.TOURNAMENT_CANCELLED]: [
    { title: 'Tournament Cancelled', message: '{tournament} has been cancelled. Check for refund details.' },
  ],
  [NotificationType.TOURNAMENT_UPDATE]: [
    { title: 'Tournament Update', message: 'There\'s an update for {tournament}. Check the details.' },
    { title: 'Schedule Change', message: 'The schedule for {tournament} has been updated.' },
  ],
  [NotificationType.GROUP_DRAW]: [
    { title: 'Draw Completed', message: 'The draw for {tournament} is complete. Check your group!' },
    { title: 'Groups Announced', message: 'Groups have been drawn for {tournament}. See who you\'re playing!' },
  ],
  [NotificationType.PAYMENT_REMINDER]: [
    { title: 'Payment Reminder', message: 'Don\'t forget to complete your payment for {tournament}.' },
  ],
  [NotificationType.PAYMENT_COMPLETED]: [
    { title: 'Payment Confirmed', message: 'We received your payment of {amount} for {tournament}.' },
    { title: 'Payment Successful', message: 'Your payment for {tournament} has been processed successfully.' },
  ],
  [NotificationType.PAYMENT_FAILED]: [
    { title: 'Payment Failed', message: 'Your payment for {tournament} could not be processed.' },
    { title: 'Payment Issue', message: 'There was a problem processing your payment. Please try again.' },
  ],
  [NotificationType.NEW_TOURNAMENT_MATCH]: [
    { title: 'Upcoming Match', message: 'Your next match in {tournament} is scheduled. Check the details!' },
  ],
  [NotificationType.SYSTEM]: [
    { title: 'System Notification', message: 'Important system update. Please review.' },
    { title: 'Platform Update', message: 'We\'ve made some improvements to the platform.' },
    { title: 'Welcome!', message: 'Welcome to Football Tournament Platform! Start by creating your club.' },
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
  
  // Generate 8-12 notifications per user (500+ total for 60 users)
  for (const userId of userIds) {
    const notificationCount = faker.number.int({ min: 8, max: 12 });
    
    for (let i = 0; i < notificationCount; i++) {
      const notificationId = generateUUID();
      const type = pickRandom(notificationTypes);
      const templates = NOTIFICATION_TEMPLATES[type];
      const template = pickRandom(templates);
      
      // Replace placeholders
      const tournamentName = pickRandom(tournamentNamesArray) || 'Summer Cup 2024';
      let title = template.title;
      let message = template.message
        .replace('{tournament}', tournamentName)
        .replace('{amount}', `€${faker.number.int({ min: 100, max: 500 })}`)
        .replace('{days}', String(faker.number.int({ min: 1, max: 14 })));
      
      const isRead = Math.random() > 0.4; // 60% read
      const createdAt = faker.date.recent({ days: 90 });
      
      await notificationRepository.insert({
        id: notificationId,
        user: { id: userId },
        type,
        title,
        message,
        isRead,
        sendEmailNotification: Math.random() > 0.3,
        emailSent: Math.random() > 0.5,
        metadata: {
          tournamentName,
          generatedAt: new Date().toISOString(),
        },
        createdAt,
      });
      
      seededNotifications.push({
        id: notificationId,
        userId,
        type,
        isRead,
      });
    }
  }
  
  console.log(`✅ Seeded ${seededNotifications.length} notifications`);
  return seededNotifications;
}
