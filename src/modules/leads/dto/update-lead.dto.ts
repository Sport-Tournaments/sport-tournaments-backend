import { PartialType } from '@nestjs/swagger';
import { CreateLeadDto } from './create-lead.dto';

/**
 * All lead fields are optional on update (status change, adding notes /
 * contact details, reassigning, etc.).
 */
export class UpdateLeadDto extends PartialType(CreateLeadDto) {}
