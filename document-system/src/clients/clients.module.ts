import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsService } from './clients.service';
import { ClientsController } from './clients.controller';
import { Application } from './entities/application.entity';
import { ApplicationsRepository } from './repositories/applications.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Application])],
  providers: [ClientsService, ApplicationsRepository],
  controllers: [ClientsController],
  exports: [ClientsService, ApplicationsRepository],
})
export class ClientsModule { }

