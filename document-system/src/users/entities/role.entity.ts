import { Entity, Column, ManyToMany, JoinTable } from 'typeorm';
import { AbstractBaseEntity } from '../../database/entities/base.entity';
import { Permission } from './permission.entity';

@Entity('roles')
export class Role extends AbstractBaseEntity {
    @Column({ type: 'varchar', length: 50, unique: true })
    name: string;

    @Column({ type: 'varchar', length: 255, nullable: true })
    description: string;

    @ManyToMany(() => Permission, { cascade: true, eager: true })
    @JoinTable({
        name: 'role_permissions',
        joinColumn: { name: 'role_id', referencedColumnName: 'id' },
        inverseJoinColumn: { name: 'permission_id', referencedColumnName: 'id' },
    })
    permissions: Permission[];
}
