import { DataSource } from 'typeorm';

export function createTestDataSource(): DataSource {
  const mockRepo = {
    find: async () => [],
    findOne: async () => null,
    save: async <T>(entity: T): Promise<T> => entity,
    create: <T>(entity: T): T => entity,
    update: async () => ({ affected: 1 }),
    delete: async () => ({ affected: 1 }),
  };

  return {
    isInitialized: true,
    entityMetadatas: [],
    options: { type: 'postgres' },
    query: async () => [{ ok: 1 }],
    getRepository: () => mockRepo,
    getTreeRepository: () => mockRepo,
    getMongoRepository: () => mockRepo,
  } as unknown as DataSource;
}
