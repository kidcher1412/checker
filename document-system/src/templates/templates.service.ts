import { Injectable, BadRequestException } from '@nestjs/common';
import { TemplatesRepository } from './repositories/templates.repository';
import * as Handlebars from 'handlebars';

@Injectable()
export class TemplatesService {
    constructor(private readonly templatesRepository: TemplatesRepository) { }

    async checkTimeOverlap(templateCode: string, validFrom: Date | null, validTo: Date | null, currentVersionId?: string) {
        const templates = await this.templatesRepository.findByTemplateCode(templateCode);
        const timeBased = templates.filter(t => t.isTimeBased && t.id !== currentVersionId && t.status === 'ACTIVE');

        for (const t of timeBased) {
            let overlap = false;

            // Check overlaps
            if (!validFrom && !validTo) overlap = true;
            else if (!t.validFrom && !t.validTo) overlap = true;
            else if (validFrom && validTo && t.validFrom && t.validTo) overlap = validFrom <= t.validTo && validTo >= t.validFrom;
            else if (validFrom && !validTo && t.validFrom && t.validTo) overlap = validFrom <= t.validTo;
            else if (!validFrom && validTo && t.validFrom && t.validTo) overlap = validTo >= t.validFrom;
            else if (validFrom && validTo && !t.validFrom && t.validTo) overlap = validFrom <= t.validTo;
            else if (validFrom && validTo && t.validFrom && !t.validTo) overlap = validTo >= t.validFrom;
            else if (!validFrom && validTo && !t.validFrom && t.validTo) overlap = true;
            else if (!validFrom && validTo && t.validFrom && !t.validTo) overlap = validTo >= t.validFrom;
            else if (validFrom && !validTo && !t.validFrom && t.validTo) overlap = validFrom <= t.validTo;
            else if (validFrom && !validTo && t.validFrom && !t.validTo) overlap = true;

            if (overlap) {
                // Auto crop the existing template (t) based on the newly saved one.
                // Priority goes to the one being saved currently.
                if (validFrom && (!t.validTo || validFrom <= t.validTo)) {
                    // New one starts, so the old one must end before the new one starts
                    t.validTo = new Date(validFrom.getTime() - 1000); // 1 second before
                } else if (validTo && (!t.validFrom || validTo >= t.validFrom)) {
                    // New one ends, so old one must start after the new one ends
                    t.validFrom = new Date(validTo.getTime() + 1000);
                }

                // If somehow it gets inverted (invalid range), mark it inactive or remove from timeline
                if (t.validFrom && t.validTo && t.validFrom > t.validTo) {
                    t.isTimeBased = false;
                    t.validFrom = null;
                    t.validTo = null;
                }

                await this.templatesRepository.save(t);
            }
        }
    }

    async createTemplate(data: any) {
        const existing = await this.templatesRepository.findByTemplateCode(data.templateCode);

        let newVersion = 1;
        if (existing.length > 0) {
            newVersion = Math.max(...existing.map(t => t.version)) + 1;
        }

        if (data.isTimeBased) {
            await this.checkTimeOverlap(
                data.templateCode,
                data.validFrom ? new Date(data.validFrom) : null,
                data.validTo ? new Date(data.validTo) : null
            );
        }

        const template = this.templatesRepository.create({ ...data, version: newVersion });
        return this.templatesRepository.save(template);
    }

    async updateTemplate(id: string, data: any) {
        const template = await this.templatesRepository.findOneById(id);
        if (!template) throw new BadRequestException(`Template not found`);

        if (data.templateName !== undefined) template.templateName = data.templateName;
        if (data.templateLayout !== undefined) template.templateLayout = data.templateLayout;
        if (data.schemaVariables !== undefined) template.schemaVariables = data.schemaVariables;
        if (data.isTimeBased !== undefined) template.isTimeBased = data.isTimeBased;
        if (data.validFrom !== undefined) template.validFrom = data.validFrom ? new Date(data.validFrom) : null;
        if (data.validTo !== undefined) template.validTo = data.validTo ? new Date(data.validTo) : null;
        if (data.status !== undefined) template.status = data.status;
        if (data.watermarks !== undefined) template.watermarks = data.watermarks;
        if (data.pageConfig !== undefined) template.pageConfig = data.pageConfig;

        if (template.isTimeBased) {
            await this.checkTimeOverlap(template.templateCode, template.validFrom, template.validTo, template.id);
        }

        await this.templatesRepository.save(template);
        return template;
    }

    async deleteTemplateVersion(id: string) {
        await this.templatesRepository.delete(id);
        return { success: true };
    }

    async getAllTemplates() {
        const templates = await this.templatesRepository.findAllActive();

        const map = new Map<string, any>();
        for (const t of templates) {
            if (!map.has(t.templateCode) || map.get(t.templateCode).version < t.version) {
                map.set(t.templateCode, { ...t });
            }
        }

        const uniqueTemplates = Array.from(map.values()) as any[];
        for (const t of uniqueTemplates) {
            const active = await this.templatesRepository.findActiveTemplateCode(t.templateCode, new Date());
            t.currentActiveVersion = active ? active.version : null;
        }

        return uniqueTemplates;
    }

    async getTemplateByCode(code: string) {
        // Return latest or all? Let's return all versions for the UI
        return this.templatesRepository.findByTemplateCode(code);
    }

    async getActiveTemplate(code: string, dateStr?: string, versionOverride?: number) {
        if (versionOverride) {
            const t = await this.templatesRepository.findByCodeAndVersion(code, versionOverride);
            if (!t) throw new BadRequestException(`Template code ${code} version ${versionOverride} not found`);
            return t;
        }

        const date = dateStr ? new Date(dateStr) : new Date();
        const t = await this.templatesRepository.findActiveTemplateCode(code, date);
        if (!t) throw new BadRequestException(`No active template found for code ${code} at the specified time`);
        return t;
    }

    previewTemplate(layout: string, data: any): string {
        try {
            const compiledTemplate = Handlebars.compile(layout);
            return compiledTemplate(data);
        } catch (e: any) {
            throw new BadRequestException('Template compilation failed: ' + e.message);
        }
    }
}
