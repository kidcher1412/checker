import { Controller, Post, Body, Get, Param, UseGuards, Put, Delete, Res, Headers } from '@nestjs/common';
import { TemplatesService } from './templates.service';
import { GeneratorService } from '../generator/generator.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import type { Response } from 'express';

@Controller('api/templates')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TemplatesController {
    constructor(
        private readonly templatesService: TemplatesService,
        private readonly generatorService: GeneratorService
    ) { }

    @Post()
    @RequirePermissions('template:write')
    async createTemplate(@Body() body: any) {
        // If ID is passed by mistake from the frontend during "save", we should ignore it on POST usually,
        // but let's let the service handle it as a new version.
        if (body.id) delete body.id;
        return this.templatesService.createTemplate(body);
    }

    @Put(':id')
    @RequirePermissions('template:write')
    async updateTemplate(@Param('id') id: string, @Body() body: any) {
        return this.templatesService.updateTemplate(id, body);
    }

    @Delete(':id')
    @RequirePermissions('template:write')
    async deleteTemplate(@Param('id') id: string) {
        return this.templatesService.deleteTemplateVersion(id);
    }

    @Get()
    @RequirePermissions('template:read')
    async getAllTemplates() {
        return this.templatesService.getAllTemplates();
    }

    @Get(':code')
    @RequirePermissions('template:read')
    async getTemplate(@Param('code') code: string) {
        return this.templatesService.getTemplateByCode(code);
    }

    @Post('preview')
    @RequirePermissions('template:read')
    previewTemplate(@Body() body: { layout: string; data: any }) {
        const html = this.templatesService.previewTemplate(body.layout, body.data);
        return { html };
    }

    @Post('preview-pdf')
    @RequirePermissions('template:read')
    async previewPdf(
        @Body() body: { templateCode: string; data: any; version?: number; layout?: string; watermarks?: any[] },
        @Headers() headers: any,
        @Res() res: Response
    ) {
        try {
            let pdfBuffer;
            if (body.layout) {
                // Generate WYSIWYG PDF directly from React UI input (ignoring DB version)
                pdfBuffer = await this.generatorService.generatePreviewPdf(body.layout, body.watermarks || [], body.data || {}, headers);
            } else {
                pdfBuffer = await this.generatorService.generatePdf(body.templateCode, body.data || {}, body.version, headers);
            }
            res.set({
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="preview-${body.templateCode}-${Date.now()}.pdf"`,
                'Content-Length': pdfBuffer.length,
            });
            res.end(pdfBuffer);
        } catch (error: any) {
            return res.status(error.status || 500).json({
                message: 'PDF Generation Failed',
                error: error.message,
            });
        }
    }

    @Post('preview-raw-html')
    @RequirePermissions('template:read')
    async previewRawHtml(
        @Body() body: { templateCode: string; data: any; version?: number; layout?: string; watermarks?: any[] },
        @Headers() headers: any,
        @Res() res: Response
    ) {
        try {
            let htmlString;
            if (body.layout) {
                htmlString = await this.generatorService.generatePreviewHtml(body.layout, body.watermarks || [], body.data || {}, headers);
            } else {
                return res.status(400).json({ message: "Layout UI string required for direct HTML preview" });
            }
            res.set({
                'Content-Type': 'text/html',
                'Content-Disposition': `attachment; filename="preview-${body.templateCode}-${Date.now()}.html"`,
            });
            res.end(htmlString);
        } catch (error: any) {
            return res.status(error.status || 500).json({
                message: 'HTML Generation Failed',
                error: error.message,
            });
        }
    }
}
