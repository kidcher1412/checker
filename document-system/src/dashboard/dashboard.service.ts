import { Injectable } from '@nestjs/common';
import { UsersRepository } from '../users/repositories/users.repository';
import { TemplatesRepository } from '../templates/repositories/templates.repository';
import { ApplicationsRepository } from '../clients/repositories/applications.repository';

@Injectable()
export class DashboardService {
    constructor(
        private readonly usersRepository: UsersRepository,
        private readonly templatesRepository: TemplatesRepository,
        private readonly applicationsRepository: ApplicationsRepository,
    ) { }

    async getStats() {
        const usersCount = await this.usersRepository.count();
        const templatesCount = await this.templatesRepository.countDistinctCodes();
        const appsCount = await this.applicationsRepository.count();

        // Make some dummy data for the chart to match the UI requirements, 
        // since we haven't implemented a fully tracked generations table yet.
        const chartData = [
            { name: 'Mon', templates: 4, docs: 120 },
            { name: 'Tue', templates: 4, docs: 98 },
            { name: 'Wed', templates: 5, docs: 150 },
            { name: 'Thu', templates: 5, docs: 210 },
            { name: 'Fri', templates: 6, docs: 180 },
            { name: 'Sat', templates: 6, docs: 40 },
            { name: 'Sun', templates: 6, docs: 30 },
        ];

        return {
            totalUsers: usersCount,
            totalTemplates: templatesCount,
            totalApps: appsCount,
            totalDocsGenerated: 1492, // Mocked total
            chartData
        };
    }
}
