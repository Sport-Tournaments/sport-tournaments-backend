import { DataSource } from 'typeorm';
import { faker } from '@faker-js/faker';
import { generateUUID, generateInvitationToken, pickRandom } from '../utils/helpers';
import { InvitationType, InvitationStatus } from '../../modules/invitations/entities/invitation.entity';

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
  clubs: { id: string; ownerId: string; email?: string }[],
): Promise<SeededInvitation[]> {
  const invitationRepository = dataSource.getRepository('TournamentInvitation');
  
  const seededInvitations: SeededInvitation[] = [];
  
  // Only send invitations for DRAFT, PUBLISHED, ONGOING tournaments
  const eligibleTournaments = tournaments.filter(t => 
    ['DRAFT', 'PUBLISHED', 'ONGOING'].includes(t.status)
  );
  
  // Track used combinations to avoid duplicates
  const usedCombinations = new Set<string>();
  
  for (const tournament of eligibleTournaments) {
    // Each tournament sends 2-5 invitations
    const invitationCount = faker.number.int({ min: 2, max: 5 });
    
    // Filter out clubs owned by the tournament organizer
    const eligibleClubs = clubs.filter(c => c.ownerId !== tournament.organizerId);
    
    for (let i = 0; i < invitationCount && eligibleClubs.length > 0; i++) {
      const invitationId = generateUUID();
      
      // Choose invitation type with weights
      const typeRoll = Math.random();
      let type: InvitationType;
      if (typeRoll < 0.4) {
        type = InvitationType.DIRECT;
      } else if (typeRoll < 0.6) {
        type = InvitationType.EMAIL;
      } else if (typeRoll < 0.8) {
        type = InvitationType.PAST_PARTICIPANT;
      } else {
        type = InvitationType.PARTNER;
      }
      
      // Choose status based on tournament status
      let status: InvitationStatus;
      if (tournament.status === 'DRAFT') {
        status = InvitationStatus.PENDING;
      } else {
        const statusRoll = Math.random();
        if (statusRoll < 0.3) {
          status = InvitationStatus.PENDING;
        } else if (statusRoll < 0.6) {
          status = InvitationStatus.ACCEPTED;
        } else if (statusRoll < 0.8) {
          status = InvitationStatus.DECLINED;
        } else {
          status = InvitationStatus.EXPIRED;
        }
      }
      
      const invitationData: Record<string, unknown> = {
        id: invitationId,
        tournament: { id: tournament.id },
        type,
        status,
        invitationToken: generateInvitationToken(),
        expiresAt: faker.date.future({ years: 0.5 }),
        message: faker.helpers.arrayElement([
          'We would love to have your club participate in our tournament!',
          'Your club has been selected for this prestigious event.',
          'Join us for an exciting tournament experience!',
          'Based on your previous participation, we\'re inviting you back!',
          null,
        ]),
        emailSent: Math.random() > 0.3,
        emailSentAt: Math.random() > 0.5 ? faker.date.recent({ days: 30 }) : null,
        reminderSent: Math.random() > 0.7,
        reminderCount: faker.number.int({ min: 0, max: 2 }),
        createdAt: faker.date.recent({ days: 60 }),
        updatedAt: new Date(),
      };
      
      // For DIRECT and PAST_PARTICIPANT, link to a club
      if (type === InvitationType.DIRECT || type === InvitationType.PAST_PARTICIPANT) {
        const club = pickRandom(eligibleClubs);
        const comboKey = `${tournament.id}-${club.id}`;
        
        if (usedCombinations.has(comboKey)) {
          continue; // Skip duplicate
        }
        usedCombinations.add(comboKey);
        
        invitationData.club = { id: club.id };
        
        if (status === InvitationStatus.ACCEPTED) {
          invitationData.respondedAt = faker.date.recent({ days: 30 });
        } else if (status === InvitationStatus.DECLINED) {
          invitationData.respondedAt = faker.date.recent({ days: 30 });
          invitationData.responseMessage = faker.helpers.arrayElement([
            'Schedule conflict',
            'Already registered for another tournament',
            'Budget constraints',
            'Team not available',
            null,
          ]);
        }
        
        seededInvitations.push({
          id: invitationId,
          tournamentId: tournament.id,
          clubId: club.id,
          type,
          status,
        });
      } else {
        // For EMAIL and PARTNER, use email only
        const email = faker.internet.email();
        const comboKey = `${tournament.id}-${email}`;
        
        if (usedCombinations.has(comboKey)) {
          continue;
        }
        usedCombinations.add(comboKey);
        
        invitationData.email = email;
        
        seededInvitations.push({
          id: invitationId,
          tournamentId: tournament.id,
          email,
          type,
          status,
        });
      }
      
      await invitationRepository.insert(invitationData);
    }
  }
  
  console.log(`✅ Seeded ${seededInvitations.length} invitations`);
  return seededInvitations;
}
