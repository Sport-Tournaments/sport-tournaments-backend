import { Global, Module } from '@nestjs/common';
import { ConversionsService } from './conversions.service';

@Global()
@Module({
  providers: [ConversionsService],
  exports: [ConversionsService],
})
export class ConversionsModule {}
