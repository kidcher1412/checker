import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { UsersRepository } from './repositories/users.repository';
import { RolesRepository } from './repositories/roles.repository';
import { User } from './entities/user.entity';
import { DeepPartial } from 'typeorm';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService implements OnModuleInit {
    private readonly logger = new Logger(UsersService.name);

    constructor(
        private readonly usersRepository: UsersRepository,
        private readonly rolesRepository: RolesRepository
    ) { }

    async onModuleInit() {
        // Seed default admin
        const adminEmail = 'admin@system.local';
        const existingAdmin = await this.findByEmail(adminEmail);
        if (!existingAdmin) {
            // Create role & permissions conceptually
            const adminRole = this.rolesRepository.create({
                name: 'Super Admin',
                permissions: [
                    { action: 'template:read', description: 'Read Templates' } as any,
                    { action: 'template:write', description: 'Write Templates' } as any
                ]
            });
            await this.rolesRepository.save(adminRole);

            const salt = await bcrypt.genSalt();
            const passwordHash = await bcrypt.hash('admin123', salt);

            await this.create({
                email: adminEmail,
                passwordHash,
                roles: [adminRole]
            });
            this.logger.log(`Default admin created: ${adminEmail} / admin123`);
        }
    }

    async findByEmail(email: string): Promise<User | null> {
        return this.usersRepository.findByEmail(email);
    }

    async findAll(): Promise<User[]> {
        const users = await this.usersRepository.findAll();
        // Don't leak password hashes
        return users.map((user: User) => {
            const { passwordHash, refreshToken, ...safeUser } = user;
            return safeUser as User;
        });
    }

    async create(userData: DeepPartial<User>): Promise<User> {
        const user = this.usersRepository.create(userData);
        return this.usersRepository.save(user);
    }

    async createUser(data: { email: string; password?: string; roleName?: string }) {
        const exist = await this.findByEmail(data.email);
        if (exist) throw new Error('User already exists');

        const salt = await bcrypt.genSalt();
        const passwordHash = await bcrypt.hash(data.password || 'password123', salt);

        let roles = [];
        if (data.roleName) {
            const role = await this.rolesRepository.findOne({ where: { name: data.roleName } });
            if (role) roles.push(role);
        }

        const user = await this.create({
            email: data.email,
            passwordHash,
            roles
        });
        const { passwordHash: ph, refreshToken: rt, ...safe } = user;
        return safe;
    }

    async updateUser(id: string, data: { isActive?: boolean; roleName?: string; password?: string }) {
        const user = await this.usersRepository.findOne({ where: { id }, relations: ['roles'] });
        if (!user) throw new Error('User not found');

        if (data.isActive !== undefined) user.isActive = data.isActive;
        if (data.password) {
            const salt = await bcrypt.genSalt();
            user.passwordHash = await bcrypt.hash(data.password, salt);
        }
        if (data.roleName !== undefined) {
            const role = await this.rolesRepository.findOne({ where: { name: data.roleName } });
            user.roles = role ? [role] : [];
        }

        await this.usersRepository.save(user);
        const { passwordHash: ph, refreshToken: rt, ...safe } = user;
        return safe;
    }

    async deleteUser(id: string) {
        await this.usersRepository.delete(id);
        return { success: true };
    }

    async updateRefreshToken(userId: string, refreshToken: string | null): Promise<void> {
        await this.usersRepository.update(userId, { refreshToken });
    }
}
