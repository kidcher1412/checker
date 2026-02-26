import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
    imports: [
        TypeOrmModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ({
                type: configService.get<any>('DB_TYPE', 'sqlite'),
                database: configService.get<string>('DB_DATABASE', 'database.sqlite'),
                host: configService.get<string>('DB_HOST'),
                port: configService.get<number>('DB_PORT'),
                username: configService.get<string>('DB_USERNAME'),
                password: configService.get<string>('DB_PASSWORD'),
                entities: [__dirname + '/../**/*.entity{.ts,.js}'],
                subscribers: [__dirname + '/../**/*.subscriber{.ts,.js}'],
                synchronize: configService.get<boolean>('DB_SYNC', true), // Warning: Use migrations in prod!
            }),
        }),
    ],
})
export class DatabaseModule { }
