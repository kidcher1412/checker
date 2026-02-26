import { DeepPartial, FindManyOptions, FindOneOptions, UpdateResult, DeleteResult } from 'typeorm';

export interface IBaseRepository<T> {
  create(data: DeepPartial<T>): T;
  createMany(data: DeepPartial<T>[]): T[];
  save(data: DeepPartial<T>): Promise<T>;
  saveMany(data: DeepPartial<T>[]): Promise<T[]>;
  findOne(options: FindOneOptions<T>): Promise<T | null>;
  findOneById(id: any): Promise<T | null>;
  findAll(options?: FindManyOptions<T>): Promise<T[]>;
  findAndCount(options?: FindManyOptions<T>): Promise<[T[], number]>;
  update(id: any, data: DeepPartial<T>): Promise<UpdateResult>;
  softDelete(id: any): Promise<UpdateResult>;
  delete(id: any): Promise<DeleteResult>;
  restore(id: any): Promise<UpdateResult>;
}
