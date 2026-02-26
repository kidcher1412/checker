import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ApplicationsRepository } from './repositories/applications.repository';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { EncryptionHelper } from '../utils/encryption.helper';

@Injectable()
export class ClientsService {
    constructor(private readonly applicationsRepository: ApplicationsRepository) { }

    async createApplication(appName: string, ownerId?: string) {
        const appCode = crypto.randomUUID();
        const rawSecret = crypto.randomBytes(32).toString('hex');
        const secretKeyHash = EncryptionHelper.encrypt(rawSecret);

        const newApp = this.applicationsRepository.create({
            appName,
            appCode,
            secretKeyHash,
            owner: ownerId ? { id: ownerId } as any : null,
        });

        await this.applicationsRepository.save(newApp);

        // Return the raw secret ONLY ONCE in the standard response, 
        // though admins can now reveal it later.
        return {
            appName,
            appCode,
            rawSecret,
        };
    }

    async findAll() {
        return this.applicationsRepository.findAll();
    }

    async findById(id: string) {
        return this.applicationsRepository.findById(id);
    }

    async validateClient(appCode: string, appSecret: string): Promise<boolean> {
        const app = await this.applicationsRepository.findByAppCode(appCode);
        if (!app || !app.isActive) {
            return false;
        }

        // Decrypt stored secret and compare
        try {
            const decryptedStoredSecret = EncryptionHelper.decrypt(app.secretKeyHash);
            return decryptedStoredSecret === appSecret;
        } catch (e) {
            // Fallback for bcrypt (if any still exist during migration)
            return await bcrypt.compare(appSecret, app.secretKeyHash);
        }
    }

    async updateApplication(id: string, data: { appName?: string; isActive?: boolean; assignedTemplates?: string[] }) {
        const app = await this.applicationsRepository.findById(id);
        if (!app) throw new Error('Application not found');
        if (data.appName !== undefined) app.appName = data.appName;
        if (data.isActive !== undefined) app.isActive = data.isActive;
        if (data.assignedTemplates !== undefined) app.assignedTemplates = data.assignedTemplates;
        await this.applicationsRepository.save(app);
        return app;
    }

    async deleteApplication(id: string) {
        await this.applicationsRepository.delete(id);
        return { success: true };
    }

    async rotateSecret(id: string) {
        const app = await this.applicationsRepository.findById(id);
        if (!app) throw new Error('Application not found');

        const rawSecret = crypto.randomBytes(32).toString('hex');
        app.secretKeyHash = EncryptionHelper.encrypt(rawSecret);
        await this.applicationsRepository.save(app);

        return {
            appCode: app.appCode,
            rawSecret
        };
    }

    async revealSecret(id: string) {
        const app = await this.applicationsRepository.findById(id);
        if (!app) throw new Error('Application not found');

        try {
            const rawSecret = EncryptionHelper.decrypt(app.secretKeyHash);
            return {
                appCode: app.appCode,
                rawSecret
            };
        } catch (e) {
            throw new Error('Unable to decrypt legacy secret. Please rotate the secret.');
        }
    }
}
