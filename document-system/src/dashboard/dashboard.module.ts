import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { UsersModule } from '../users/users.module';
import { TemplatesModule } from '../templates/templates.module';
import { ClientsModule } from '../clients/clients.module';

@Module({
    imports: [UsersModule, TemplatesModule, ClientsModule],
    controllers: [DashboardController],
    providers: [DashboardService],
})
export class DashboardModule { }
