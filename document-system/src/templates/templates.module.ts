import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TemplatesService } from './templates.service';
import { TemplatesController } from './templates.controller';
import { Template } from './entities/template.entity';
import { TemplatesRepository } from './repositories/templates.repository';
import { GeneratorModule } from '../generator/generator.module';

@Module({
  imports: [TypeOrmModule.forFeature([Template]), forwardRef(() => GeneratorModule)],
  controllers: [TemplatesController],
  providers: [TemplatesService, TemplatesRepository],
  exports: [TemplatesService, TemplatesRepository],
})
export class TemplatesModule { }
