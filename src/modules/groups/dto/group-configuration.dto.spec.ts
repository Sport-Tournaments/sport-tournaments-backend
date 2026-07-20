import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ConfigureGroupsDto } from './group-configuration.dto';

describe('ConfigureGroupsDto', () => {
  it('accepts manual group configuration with group letters and age group scope', async () => {
    const dto = plainToInstance(ConfigureGroupsDto, {
      numberOfGroups: 2,
      ageGroupId: '11111111-1111-4111-8111-111111111111',
      teamsPerGroup: [
        { groupLetter: 'A', teamCount: 5 },
        { groupLetter: 'B', teamCount: 5 },
      ],
    });

    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    expect(errors).toEqual([]);
  });
});
