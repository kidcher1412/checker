import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { UsersRepository } from './repositories/users.repository';
import { RolesRepository } from './repositories/roles.repository';

import { UsersController } from './users.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User, Role, Permission])],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository, RolesRepository],
  exports: [UsersService, UsersRepository, RolesRepository],
})
export class UsersModule { }
