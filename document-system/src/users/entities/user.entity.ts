import { Entity, Column, ManyToMany, JoinTable } from 'typeorm';
import { AbstractBaseEntity } from '../../database/entities/base.entity';
import { Role } from './role.entity';

@Entity('users')
export class User extends AbstractBaseEntity {
    @Column({ type: 'varchar', length: 100, unique: true })
    email: string;

    @Column({ type: 'varchar', length: 255 })
    passwordHash: string;

    @Column({ type: 'varchar', length: 255, nullable: true })
    refreshToken: string | null;

    @Column({ type: 'boolean', default: true })
    isActive: boolean;

    @ManyToMany(() => Role, { cascade: true, eager: true })
    @JoinTable({
        name: 'user_roles',
        joinColumn: { name: 'user_id', referencedColumnName: 'id' },
        inverseJoinColumn: { name: 'role_id', referencedColumnName: 'id' },
    })
    roles: Role[];
}
