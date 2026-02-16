import { DataSource } from 'typeorm';
import {
  faker,
  generateUUID,
  generateInvitationToken,
  pickRandom,
  seedDate,
  seedDateFuture,
} from '../utils/helpers';
import {
  InvitationType,
  InvitationStatus,
} from '../../modules/invitations/entities/invitation.entity';

export interface SeededInvitation {
  id: string;
  tournamentId: string;
  clubId?: string;
  email?: string;
  type: InvitationType;
  status: InvitationStatus;
}

export async function seedInvitations(
  dataSource: DataSource,
  tournaments: { id: string; organizerId: string; status: string }[],
  clubs: { id: string; ownerId: string }[],
): Promise<SeededInvitation[]> {
  const invitationRepository = dataSource.getRepository('TournamentInvitation');
  const seededInvitations: SeededInvitation[] = [];
  const usedCombinations = new Set<string>();

  const eligibleTournaments = tournaments.filter((t) =>
    ['DRAFT', 'PUBLISHED', 'ONGOING'].includes(t.status),
  );

  for (const tournament of eligibleTournaments) {
    const invitationCount = faker.number.int({ min: 2, max: 5 });
    const eligibleClubs = clubs.filter((c) => c.ownerId !== tournament.organizerId);

    for (let i = 0; i < invitationCount && eligibleClubs.length > 0; i++) {
      const invitationId = generateUUID();

      const typeRoll = Math.random();
      let type: InvitationType;
      if (typeRoll < 0.4) type = InvitationType.DIRECT;
      else if (typeRoll < 0.6) type = InvitationType.EMAIL;
      else if (typeRoll < 0.8) type = InvitationType.PAST_PARTICIPANT;
      else type = InvitationType.PARTNER;

      let status: InvitationStatus;
      if (tournament.status === 'DRAFT') {
        status = InvitationStatus.PENDING;
      } else {
        const r = Math.random();
        if (r < 0.3) status = InvitationStatus.PENDING;
        else if (r < 0.6) status = InvitationStatus.ACCEPTED;
        else if (r < 0.8) status = InvitationStatus.DECLINED;
        else status = InvitationStatus.EXPIRED;
      }

      const invitationData: Record<string, unknown> = {
        id: invitationId,
        tournament: { id: tournament.id },
        type,
        status,
        invitationToken: generateInvitationToken(),
        expiresAt: seedDateFuture(),
        message: faker.helpers.arrayElement([
          'Vă invităm să participați la turneul nostru!',
          'Clubul dumneavoastră a fost selectat pentru acest eveniment.',
          'Alăturați-vă pentru o experiență sportivă de excepție!',
          null,
        ]),
        emailSent: Math.random() > 0.3,
        emailSentAt: Math.random() > 0.5 ? seedDate() : null,
        reminderSent: Math.random() > 0.7,
        reminderCount: faker.number.int({ min: 0, max: 2 }),
        createdAt: seedDate(),
        updatedAt: new Date(),
      };

      if (type === InvitationType.DIRECT || type === InvitationType.PAST_PARTICIPANT) {
        const club = pickRandom(eligibleClubs);
        const comboKey = `${tournament.id}-${club.id}`;
        if (usedCombinations.has(comboKey)) continue;
        usedCombinations.add(comboKey);
        invitationData.club = { id: club.id };

        if (status === InvitationStatus.ACCEPTED || status === InvitationStatus.DECLINED) {
          invitationData.respondedAt = seedDate();
        }
        if (status === InvitationStatus.DECLINED) {
          invitationData.responseMessage = faker.helpers.arrayElement([
            'Conflict de program',
            'Deja înscriși la alt turneu',
            'Buget insuficient',
            null,
          ]);
        }

        seededInvitations.push({ id: invitationId, tournamentId: tournament.id, clubId: club.id, type, status });
      } else {
        const email = faker.internet.email();
        const comboKey = `${tournament.id}-${email}`;
        if (usedCombinations.has(comboKey)) continue;
        usedCombinations.add(comboKey);
        invitationData.email = email;
        seededInvitations.push({ id: invitationId, tournamentId: tournament.id, email, type, status });
      }

      await invitationRepository.insert(invitationData);
    }
  }

  console.log(`✅ Seeded ${seededInvitations.length} invitations`);
  return seededInvitations;
}
