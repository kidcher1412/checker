import { DeepPartial, FindManyOptions, FindOneOptions, Repository, UpdateResult, DeleteResult } from 'typeorm';
import { IBaseRepository } from '../interfaces/base.repository.interface';

export abstract class BaseRepository<T extends { id: any }> implements IBaseRepository<T> {
    protected constructor(protected readonly repository: Repository<T>) { }

    public create(data: DeepPartial<T>): T {
        return this.repository.create(data);
    }

    public createMany(data: DeepPartial<T>[]): T[] {
        return this.repository.create(data);
    }

    public async save(data: DeepPartial<T>): Promise<T> {
        return await this.repository.save(data);
    }

    public async saveMany(data: DeepPartial<T>[]): Promise<T[]> {
        return await this.repository.save(data);
    }

    public async findOne(options: FindOneOptions<T>): Promise<T | null> {
        return await this.repository.findOne(options);
    }

    public async findOneById(id: any): Promise<T | null> {
        return await this.repository.findOne({ where: { id } as any });
    }

    public async findAll(options?: FindManyOptions<T>): Promise<T[]> {
        return await this.repository.find(options);
    }

    public async findAndCount(options?: FindManyOptions<T>): Promise<[T[], number]> {
        return await this.repository.findAndCount(options);
    }

    public async update(id: any, data: DeepPartial<T>): Promise<UpdateResult> {
        return await this.repository.update(id, data as any);
    }

    public async softDelete(id: any): Promise<UpdateResult> {
        return await this.repository.softDelete(id);
    }

    public async delete(id: any): Promise<DeleteResult> {
        return await this.repository.delete(id);
    }

    public async restore(id: any): Promise<UpdateResult> {
        return await this.repository.restore(id);
    }
}
