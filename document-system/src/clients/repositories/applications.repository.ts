import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Application } from '../entities/application.entity';
import { BaseRepository } from '../../database/repositories/base.repository';

@Injectable()
export class ApplicationsRepository extends BaseRepository<Application> {
    constructor(
        @InjectRepository(Application)
        private readonly applicationsRepository: Repository<Application>,
    ) {
        super(applicationsRepository);
    }

    async findByAppCode(appCode: string): Promise<Application | null> {
        return this.applicationsRepository.findOne({ where: { appCode } });
    }

    async findAll(): Promise<Application[]> {
        return this.applicationsRepository.find({ relations: ['owner'] });
    }

    async findById(id: string): Promise<Application | null> {
        return this.applicationsRepository.findOne({ where: { id }, relations: ['owner'] });
    }

    async count(): Promise<number> {
        return this.applicationsRepository.count();
    }
}
