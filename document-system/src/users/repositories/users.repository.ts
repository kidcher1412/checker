import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { BaseRepository } from '../../database/repositories/base.repository';

@Injectable()
export class UsersRepository extends BaseRepository<User> {
    constructor(
        @InjectRepository(User)
        private readonly usersRepository: Repository<User>,
    ) {
        super(usersRepository);
    }

    async findByEmail(email: string): Promise<User | null> {
        return this.usersRepository.findOne({ where: { email } });
    }

    async findAll(): Promise<User[]> {
        return this.usersRepository.find({ relations: ['roles'] });
    }

    async count(): Promise<number> {
        return this.usersRepository.count();
    }
}
