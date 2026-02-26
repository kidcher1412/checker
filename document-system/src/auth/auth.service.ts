import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
    constructor(
        private readonly usersService: UsersService,
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
    ) { }

    async validateUser(email: string, pass: string): Promise<any> {
        const user = await this.usersService.findByEmail(email);
        if (user && await bcrypt.compare(pass, user.passwordHash)) {
            if (!user.isActive) {
                throw new UnauthorizedException('Tài khoản đã bị khoá');
            }
            const { passwordHash, refreshToken, ...result } = user;
            return result;
        }
        return null;
    }

    async login(user: any) {
        const payload = { email: user.email, sub: user.id, roles: user.roles };
        const accessToken = this.jwtService.sign(payload);

        // Generate refresh token manually since we use long lived token
        const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET', 'refresh-secret-change-in-prod');
        const refreshToken = this.jwtService.sign(payload, { secret: refreshSecret, expiresIn: '7d' });

        // Store hashed refresh token in DB or plain (better hashed)
        const salt = await bcrypt.genSalt();
        const hashedRefreshToken = await bcrypt.hash(refreshToken, salt);
        await this.usersService.updateRefreshToken(user.id, hashedRefreshToken);

        return {
            access_token: accessToken,
            refresh_token: refreshToken,
        };
    }

    async refreshToken(userEmail: string, requestRefreshToken: string) {
        const user = await this.usersService.findByEmail(userEmail);
        if (!user || !user.refreshToken) {
            throw new UnauthorizedException('Access Denied');
        }

        const isRefreshTokenMatching = await bcrypt.compare(requestRefreshToken, user.refreshToken);
        if (!isRefreshTokenMatching) {
            throw new UnauthorizedException('Access Denied');
        }

        const payload = { email: user.email, sub: user.id, roles: user.roles };
        const accessToken = this.jwtService.sign(payload);
        // Optionally rotate refresh token
        return {
            access_token: accessToken,
        };
    }

    async logout(userId: string) {
        return this.usersService.updateRefreshToken(userId, null);
    }
}
