import { Module, forwardRef } from '@nestjs/common';
import { GeneratorService } from './generator.service';
import { GeneratorController } from './generator.controller';
import { TemplatesModule } from '../templates/templates.module';
import { ClientsModule } from '../clients/clients.module';

@Module({
  imports: [forwardRef(() => TemplatesModule), ClientsModule],
  controllers: [GeneratorController],
  providers: [GeneratorService],
  exports: [GeneratorService],
})
export class GeneratorModule { }
