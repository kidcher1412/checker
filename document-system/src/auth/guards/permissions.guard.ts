import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
    constructor(private reflector: Reflector) { }

    canActivate(context: ExecutionContext): boolean {
        const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        if (!requiredPermissions) {
            return true; // No permissions required, pass
        }

        const { user } = context.switchToHttp().getRequest();

        if (!user || !user.roles) return false;

        // Collect all unique permissions from the user's roles
        const userPermissions = user.roles.flatMap((role: any) =>
            role.permissions ? role.permissions.map((p: any) => p.action) : []
        );

        return requiredPermissions.every((permission) => userPermissions.includes(permission));
    }
}
