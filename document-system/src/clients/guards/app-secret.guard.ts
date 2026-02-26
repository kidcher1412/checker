import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ClientsService } from '../clients.service';

@Injectable()
export class AppSecretGuard implements CanActivate {
    constructor(private readonly clientsService: ClientsService) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const appCode = request.headers['x-app-code'];
        const appSecret = request.headers['x-app-secret'];

        if (!appCode || !appSecret) {
            throw new UnauthorizedException('Missing Application Credentials in Headers (X-App-Code, X-App-Secret)');
        }

        const isValid = await this.clientsService.validateClient(appCode, appSecret);
        if (!isValid) {
            throw new UnauthorizedException('Invalid Application Credentials');
        }

        // Attach appCode to request for downstream handlers
        request.appCode = appCode;
        return true;
    }
}
