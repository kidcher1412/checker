import { Entity, Column } from 'typeorm';
import { AbstractBaseEntity } from '../../database/entities/base.entity';

@Entity('permissions')
export class Permission extends AbstractBaseEntity {
    @Column({ type: 'varchar', length: 50, unique: true })
    action: string; // e.g., 'template:read', 'template:write'

    @Column({ type: 'varchar', length: 255, nullable: true })
    description: string;
}
