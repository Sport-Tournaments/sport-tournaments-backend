import { DataSource } from 'typeorm';
import { Club } from '../../modules/clubs/entities/club.entity';

/**
 * Migration to add default colors to existing clubs
 * Run this after adding primaryColor and secondaryColor columns
 */
export async function addDefaultColorsToClubs(dataSource: DataSource) {
  const clubRepository = dataSource.getRepository(Club);
  
  // Get all clubs without colors
  const clubs = await clubRepository
    .createQueryBuilder('club')
    .where('club.primaryColor IS NULL OR club.secondaryColor IS NULL')
    .getMany();

  console.log(`Found ${clubs.length} clubs without colors`);

  // Default colors - Blue & White (popular football combination)
  const defaultPrimaryColor = '#1E40AF';
  const defaultSecondaryColor = '#FFFFFF';

  // Update each club
  for (const club of clubs) {
    if (!club.primaryColor) {
      club.primaryColor = defaultPrimaryColor;
    }
    if (!club.secondaryColor) {
      club.secondaryColor = defaultSecondaryColor;
    }
    await clubRepository.save(club);
  }

  console.log(`✓ Updated ${clubs.length} clubs with default colors`);
  console.log(`  Primary: ${defaultPrimaryColor} (Blue)`);
  console.log(`  Secondary: ${defaultSecondaryColor} (White)`);
}
