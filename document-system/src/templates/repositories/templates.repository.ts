import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Template } from '../entities/template.entity';
import { BaseRepository } from '../../database/repositories/base.repository';

@Injectable()
export class TemplatesRepository extends BaseRepository<Template> {
    constructor(
        @InjectRepository(Template)
        private readonly templatesRepository: Repository<Template>,
    ) {
        super(templatesRepository);
    }

    async findByTemplateCode(templateCode: string): Promise<Template[]> {
        return this.templatesRepository.find({ where: { templateCode } });
    }

    async findActiveTemplateCode(templateCode: string, date: Date = new Date()): Promise<Template | null> {
        const query = this.templatesRepository.createQueryBuilder('template')
            .where('template.templateCode = :templateCode', { templateCode })
            .andWhere('template.status = :status', { status: 'ACTIVE' });

        // Find time-based that match date OR non-time-based (latest version)
        const templates = await query.getMany();
        if (templates.length === 0) return null;

        const timeBased = templates.filter(t => t.isTimeBased).sort((a, b) => b.version - a.version);
        if (timeBased.length > 0) {
            const matched = timeBased.find(t => {
                if (!t.validFrom && !t.validTo) return true;
                if (t.validFrom && t.validTo) return date >= t.validFrom && date <= t.validTo;
                if (t.validFrom) return date >= t.validFrom;
                if (t.validTo) return date <= t.validTo;
                return false;
            });
            return matched || null;
        }

        // Return highest version of non-time-based
        return templates.sort((a, b) => b.version - a.version)[0];
    }

    async findByCodeAndVersion(templateCode: string, version: number): Promise<Template | null> {
        return this.templatesRepository.findOne({ where: { templateCode, version } });
    }

    async findAllActive(): Promise<Template[]> {
        return this.templatesRepository.find({ where: { status: 'ACTIVE' } });
    }

    async count(): Promise<number> {
        return this.templatesRepository.count();
    }

    async countDistinctCodes(): Promise<number> {
        const result = await this.templatesRepository.createQueryBuilder('template')
            .select('COUNT(DISTINCT template.templateCode)', 'count')
            .getRawOne();
        return parseInt(result.count, 10) || 0;
    }
}
