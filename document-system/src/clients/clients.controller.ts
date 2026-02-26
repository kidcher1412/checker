import { Controller, Post, Body, UseGuards, Request, Get, Param, Put, Delete } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';

@Controller('api/clients')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ClientsController {
    constructor(private readonly clientsService: ClientsService) { }

    @Get()
    @RequirePermissions('template:read')
    async getAllClients() {
        return this.clientsService.findAll();
    }

    @Get(':id')
    @RequirePermissions('template:read')
    async getClientById(@Param('id') id: string) {
        return this.clientsService.findById(id);
    }

    @Post()
    @RequirePermissions('template:write') // Reusing template write permission for now
    async createClient(@Body() body: { appName: string }, @Request() req: any) {
        return this.clientsService.createApplication(body.appName, req.user.id);
    }

    @Put(':id')
    @RequirePermissions('template:write')
    async updateClient(@Param('id') id: string, @Body() body: any) {
        return this.clientsService.updateApplication(id, body);
    }

    @Delete(':id')
    @RequirePermissions('template:write')
    async deleteClient(@Param('id') id: string) {
        return this.clientsService.deleteApplication(id);
    }

    @Post(':id/rotate')
    @RequirePermissions('template:write')
    async rotateClientSecret(@Param('id') id: string) {
        return this.clientsService.rotateSecret(id);
    }

    @Get(':id/reveal')
    @RequirePermissions('template:write') // Requires admin level write permission to view secrets
    async revealClientSecret(@Param('id') id: string) {
        return this.clientsService.revealSecret(id);
    }
}
