import { EventSubscriber, EntitySubscriberInterface, InsertEvent, UpdateEvent, RemoveEvent } from 'typeorm';
import { AuditLog } from './audit-log.entity';

@EventSubscriber()
export class AuditLogSubscriber implements EntitySubscriberInterface {
    async afterInsert(event: InsertEvent<any>) {
        if (event.metadata.targetName !== 'AuditLog') {
            const log = event.manager.create(AuditLog, {
                entityName: event.metadata.targetName,
                entityId: event.entity?.id || 'unknown',
                action: 'INSERT',
                newValues: JSON.stringify(event.entity),
            });
            await event.manager.save(log);
        }
    }

    async afterUpdate(event: UpdateEvent<any>) {
        if (event.metadata.targetName !== 'AuditLog') {
            const dbEntity = await event.manager.findOne(event.metadata.target, { where: { id: event.entity?.id } as any });
            const log = event.manager.create(AuditLog, {
                entityName: event.metadata.targetName,
                entityId: event.entity?.id || 'unknown',
                action: 'UPDATE',
                oldValues: JSON.stringify(dbEntity),
                newValues: JSON.stringify(event.entity),
            });
            await event.manager.save(log);
        }
    }

    async afterRemove(event: RemoveEvent<any>) {
        if (event.metadata.targetName !== 'AuditLog') {
            const log = event.manager.create(AuditLog, {
                entityName: event.metadata.targetName,
                entityId: event.entityId || (event.entity?.id) || 'unknown',
                action: 'DELETE',
                oldValues: JSON.stringify(event.entity),
            });
            await event.manager.save(log);
        }
    }
}
