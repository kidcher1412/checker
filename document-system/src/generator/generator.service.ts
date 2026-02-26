import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { TemplatesService } from '../templates/templates.service';
import * as puppeteer from 'puppeteer';
import { Buffer } from 'buffer';

@Injectable()
export class GeneratorService {
    private readonly logger = new Logger(GeneratorService.name);

    constructor(private readonly templatesService: TemplatesService) { }

    async generatePdf(templateCode: string, data: any, version?: number, headers?: any): Promise<Buffer> {
        const template = await this.templatesService.getActiveTemplate(templateCode, undefined, version);
        if (!template) {
            throw new NotFoundException(`Template with code ${templateCode} not found`);
        }

        // status is already checked in findActiveTemplateCode or active override, but keeping this for safety
        if (template.status !== 'ACTIVE') {
            throw new BadRequestException(`Template ${templateCode} is not active`);
        }

        // 1. Validate Schema
        this.validateDataAgainstSchema(data, template.schemaVariables);

        // 2. Render HTML
        const bodyContent = this.templatesService.previewTemplate(template.templateLayout, data);

        let parsedWatermarks = [];
        try {
            if (template.watermarks) {
                parsedWatermarks = typeof template.watermarks === 'string' ? JSON.parse(template.watermarks) : template.watermarks;
            }
        } catch (e) { }

        return this.buildAndConvertHtml(bodyContent, parsedWatermarks, data || {}, headers || {});
    }

    async generatePreviewPdf(layoutUrlOrHtml: string, watermarks: any[], data: any, headers?: any): Promise<Buffer> {
        // Validate Data? In preview, we might just pass empty data or let errors slide.
        const bodyContent = this.templatesService.previewTemplate(layoutUrlOrHtml, data);
        const htmlString = this.buildHtmlString(bodyContent, watermarks, data || {}, headers || {});
        return this.convertHtmlToPdf(htmlString);
    }

    async generatePreviewHtml(layoutUrlOrHtml: string, watermarks: any[], data: any, headers?: any): Promise<string> {
        const bodyContent = this.templatesService.previewTemplate(layoutUrlOrHtml, data);
        return this.buildHtmlString(bodyContent, watermarks, data || {}, headers || {});
    }

    private buildAndConvertHtml(bodyContent: string, watermarksArray: any[], data: any, headers: any): Promise<Buffer> {
        const fullHtml = this.buildHtmlString(bodyContent, watermarksArray, data, headers);
        return this.convertHtmlToPdf(fullHtml);
    }

    private buildHtmlString(bodyContent: string, watermarksArray: any[], data: any, headers: any): string {
        // 3. Construct Full Document with Print CSS and Watermarks
        let watermarksHtml = '';
        if (watermarksArray && Array.isArray(watermarksArray)) {
            const activeWatermarks = watermarksArray.filter(wm => {
                if (!wm.conditionVariable || wm.conditionVariable.trim() === '') return true;
                try {
                    const fn = new Function('b', 'h', 'return ' + wm.conditionVariable.trim());
                    return !!fn(data || {}, headers || {});
                } catch (e) {
                    // Fallback to strict property access if it isn't a valid JS expression
                    const val = data?.[wm.conditionVariable.trim()];
                    return val === true || val === 'true' || val === '1' || val === 1;
                }
            });

            watermarksHtml = activeWatermarks.map(wm => {
                let styles = `position: fixed; pointer-events: none; opacity: ${wm.opacity}; white-space: nowrap; z-index: ${wm.layer === 'foreground' ? 100 : -1}; `;

                let transform = `rotate(${wm.rotation ?? 0}deg)`;
                if (wm.position === 'center') {
                    styles += `top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(${wm.rotation ?? -45}deg); `;
                } else if (wm.position === 'top-left') {
                    styles += `top: 40px; left: 40px; transform: ${transform}; `;
                } else if (wm.position === 'bottom-right') {
                    styles += `bottom: 40px; right: 40px; transform: ${transform}; `;
                } else if (wm.position === 'custom') {
                    styles += `top: ${wm.customY ?? 50}%; left: ${wm.customX ?? 50}%; transform: translate(-50%, -50%) ${transform}; `;
                }

                if (wm.position === 'tiled') {
                    return `
                    <div style="position: fixed; inset: 0; z-index: ${wm.layer === 'foreground' ? 100 : -1}; opacity: ${wm.opacity}; pointer-events: none; overflow: hidden;">
                        <div style="width: 200%; height: 200%; margin-left: -50%; margin-top: -50%; display: flex; flex-wrap: wrap; align-content: flex-start; align-items: flex-start; transform: rotate(${wm.rotation ?? -45}deg); opacity: 0.7;">
                            ${Array.from({ length: 150 }).map(() => `<div style="padding: 2rem; font-weight: bold; font-size: ${wm.fontSize}px; color: ${wm.color};">${wm.type === 'image' ? (wm.imageUrl ? `<img src="${wm.imageUrl}" style="width: ${wm.fontSize * 5}px;" />` : '') : wm.text}</div>`).join('')}
                        </div>
                    </div>`;
                }

                const content = wm.type === 'image'
                    ? (wm.imageUrl ? `<img src="${wm.imageUrl}" style="width: ${wm.fontSize * 5}px;" />` : '')
                    : `<div style="color: ${wm.color}; font-size: ${wm.fontSize}px; font-weight: bold;">${wm.text}</div>`;

                return `<div style="${styles}">${content}</div>`;
            }).join('\n');
        }

        // Exploit: Tiptap StarterKit strips all unallowed attributes (including class and styles) when grabbing HTML
        // This converts the custom page-break insert to a naked <hr> tag. 
        // Replace all references of Horizontal Rules with our dedicated Page Break DIV.
        const parsedBodyContent = bodyContent.replace(/<hr[^>]*>/gi, '<div class="page-break"></div>');

        const fullHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <style>
                    body { font-family: sans-serif; margin: 0; padding: 0; color: #000; }
                    /* Ensure page breaks render physically in Puppeteer */
                    .page-break { 
                        page-break-after: always !important; 
                        break-after: page !important; 
                        display: block !important;
                    }
                    /* Tiptap Table standard borders */
                    table { border-collapse: collapse; width: 100%; }
                    th, td { border: 1px solid #ddd; padding: 8px; }
                </style>
            </head>
            <body>
                ${watermarksHtml}
                <div class="document-content">
                    ${parsedBodyContent}
                </div>
            </body>
            </html>
        `;

        // 4. Return HTML String
        return fullHtml;
    }

    private validateDataAgainstSchema(data: any, schemaString: string) {
        try {
            if (schemaString) {
                const schema = JSON.parse(schemaString);
                if (schema.required && Array.isArray(schema.required)) {
                    for (const key of schema.required) {
                        if (data[key] === undefined) {
                            throw new BadRequestException(`Missing required variable: ${key} `);
                        }
                    }
                }
            }
        } catch (e: any) {
            if (e instanceof BadRequestException) throw e;
            this.logger.error('JSON Schema parsing error', e);
        }
    }

    private async convertHtmlToPdf(html: string): Promise<Buffer> {
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });

        try {
            const page = await browser.newPage();
            await page.setContent(html, { waitUntil: 'networkidle0' });

            const pdfBuffer = await page.pdf({
                format: 'A4',
                printBackground: true,
                margin: { top: '1cm', right: '1cm', bottom: '1cm', left: '1cm' }
            });

            return Buffer.from(pdfBuffer);
        } finally {
            await browser.close();
        }
    }
}
