import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateLeadDto } from './create-lead.dto';

/**
 * All lead fields are optional on update (status change, adding notes /
 * contact details, reassigning, etc.). The linked record is fixed at creation.
 */
export class UpdateLeadDto extends PartialType(
  OmitType(CreateLeadDto, ['tournamentId', 'clubId', 'organizerId'] as const),
) {}
