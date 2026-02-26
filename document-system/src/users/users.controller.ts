import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';

@Controller('api/users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    @Get()
    @RequirePermissions('template:read') // Just using this as a placeholder admin permission
    async getAllUsers() { // We'll add this method to the service
        return this.usersService.findAll();
    }

    @Post()
    @RequirePermissions('template:write')
    async createUser(@Body() body: any) {
        return this.usersService.createUser(body);
    }

    @Put(':id')
    @RequirePermissions('template:write')
    async updateUser(@Param('id') id: string, @Body() body: any) {
        return this.usersService.updateUser(id, body);
    }

    @Delete(':id')
    @RequirePermissions('template:write')
    async deleteUser(@Param('id') id: string) {
        return this.usersService.deleteUser(id);
    }
}
