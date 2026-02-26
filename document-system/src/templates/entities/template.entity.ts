import { Entity, Column, Unique } from 'typeorm';
import { AbstractBaseEntity } from '../../database/entities/base.entity';

@Entity('templates')
@Unique(['templateCode', 'version'])
export class Template extends AbstractBaseEntity {
    @Column({ type: 'varchar', length: 100 })
    templateName: string;

    @Column({ type: 'varchar', length: 50 })
    templateCode: string;

    @Column({ type: 'text' })
    schemaVariables: string; // JSON Schema string

    @Column({ type: 'text' })
    templateLayout: string; // Handlebars HTML string

    @Column({ type: 'int', default: 1 })
    version: number;

    @Column({ type: 'varchar', length: 20, default: 'ACTIVE' })
    status: string; // ACTIVE, INACTIVE, DRAFT

    @Column({ type: 'boolean', default: false })
    isTimeBased: boolean;

    @Column({ type: 'datetime', nullable: true })
    validFrom: Date | null;

    @Column({ type: 'datetime', nullable: true })
    validTo: Date | null;

    @Column({ type: 'json', nullable: true })
    watermarks: string; // JSON string of watermark configs

    @Column({ type: 'varchar', length: 50, default: 'tiptap' })
    builderType: string; // 'tiptap' | 'drag-drop'
}
