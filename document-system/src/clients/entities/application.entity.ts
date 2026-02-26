import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { AbstractBaseEntity } from '../../database/entities/base.entity';
import { User } from '../../users/entities/user.entity';

@Entity('applications')
export class Application extends AbstractBaseEntity {
    @Column({ type: 'varchar', length: 100 })
    appName: string;

    @Column({ type: 'varchar', length: 100, unique: true })
    appCode: string;

    @Column({ type: 'varchar', length: 255 })
    secretKeyHash: string;

    @Column({ type: 'boolean', default: true })
    isActive: boolean;

    @Column({ type: 'simple-array', nullable: true })
    assignedTemplates: string[];

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'owner_id' })
    owner: User;
}
