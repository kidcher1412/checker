import { Controller, Post, Body, UseGuards, Res, Headers } from '@nestjs/common';
import { GeneratorService } from './generator.service';
import { AppSecretGuard } from '../clients/guards/app-secret.guard';
import type { Response } from 'express';

@Controller('api/generate-document')
export class GeneratorController {
    constructor(private readonly generatorService: GeneratorService) { }

    @Post()
    @UseGuards(AppSecretGuard)
    async generateDocument(
        @Body() body: { template_code: string; data: any },
        @Headers('x-template-version') versionHeader: string,
        @Res() res: Response
    ) {
        if (!body.template_code) {
            return res.status(400).json({ message: 'template_code is required' });
        }

        try {
            const version = versionHeader ? parseInt(versionHeader, 10) : undefined;
            const pdfBuffer = await this.generatorService.generatePdf(body.template_code, body.data || {}, version);

            res.set({
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="document-${body.template_code}-${Date.now()}.pdf"`,
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
}
