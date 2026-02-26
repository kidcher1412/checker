import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('audit_logs')
export class AuditLog {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 100 })
    entityName: string;

    @Column({ type: 'varchar', length: 100 })
    entityId: string;

    @Column({ type: 'varchar', length: 20 })
    action: 'INSERT' | 'UPDATE' | 'DELETE';

    @Column({ type: 'text', nullable: true })
    oldValues: string;

    @Column({ type: 'text', nullable: true })
    newValues: string;

    @Column({ type: 'varchar', length: 100, nullable: true })
    userId: string; // The user who performed the action

    @CreateDateColumn()
    createdAt: Date;
}
