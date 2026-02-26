import { Controller, Post, Body, UnauthorizedException, Request, UseGuards, Get } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Controller('api/auth')
export class AuthController {
    constructor(
        private readonly authService: AuthService,
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
    ) { }

    @Post('login')
    async login(@Body() body: any) {
        // In production, use DTOs with validation
        const user = await this.authService.validateUser(body.email, body.password);
        if (!user) {
            throw new UnauthorizedException('Invalid credentials');
        }
        return this.authService.login(user); // returns token
    }

    @Post('refresh')
    async refresh(@Body() body: any) {
        try {
            const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET', 'refresh-secret-change-in-prod');
            const payload = this.jwtService.verify(body.refresh_token, { secret: refreshSecret });
            return this.authService.refreshToken(payload.email, body.refresh_token);
        } catch (e) {
            throw new UnauthorizedException('Invalid refresh token');
        }
    }

    @UseGuards(JwtAuthGuard)
    @Post('logout')
    async logout(@Request() req: any) {
        if (!req.user) {
            throw new UnauthorizedException();
        }
        await this.authService.logout(req.user.id);
        return { message: 'Logged out successfully' };
    }

    @UseGuards(JwtAuthGuard)
    @Get('me')
    getProfile(@Request() req: any) {
        return req.user;
    }
}
