import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '../entities/role.entity';
import { BaseRepository } from '../../database/repositories/base.repository';

@Injectable()
export class RolesRepository extends BaseRepository<Role> {
    constructor(
        @InjectRepository(Role)
        private readonly rolesRepository: Repository<Role>,
    ) {
        super(rolesRepository);
    }

    async findByName(name: string): Promise<Role | null> {
        return this.rolesRepository.findOne({ where: { name } });
    }
}
