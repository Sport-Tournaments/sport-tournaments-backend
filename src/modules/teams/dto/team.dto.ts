import { IsString, MinLength, MaxLength, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTeamDto {
  @ApiProperty({ description: 'Club ID for the team' })
  @IsUUID()
  clubId: string;

  @ApiProperty({ example: 'U17 A', description: 'Team name' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;
}
