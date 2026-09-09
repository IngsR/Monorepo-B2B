import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { ILike, Repository } from 'typeorm';
import { paginate, PaginatedResponse } from '../common/dto/paginated-response.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { UserQueryDto } from './dto/user-query.dto.js';
import { User } from './entities/user.entity.js';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  /** Digunakan AuthService */
  async findByEmail(email: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { email } });
  }

  /** Digunakan AuthService */
  async findById(id: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { id } });
  }

  async findAll(query: UserQueryDto): Promise<PaginatedResponse<Omit<User, 'passwordHash'>>> {
    const where: Record<string, unknown> = {};

    if (query.role) where['role'] = query.role;
    if (query.status) where['status'] = query.status;
    if (query.companyId) where['companyId'] = query.companyId;
    if (query.search) where['email'] = ILike(`%${query.search}%`);

    const [users, total] = await this.userRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: query.skip,
      take: query.limit,
    });

    const data = users.map((u) => this.sanitizeUser(u));
    return paginate(data, total, query.page, query.limit);
  }

  async findOneOrFail(id: string): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.userRepo.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException(`User with id "${id}" not found`);
    }

    return this.sanitizeUser(user);
  }

  private sanitizeUser(user: User): Omit<User, 'passwordHash'> {
    const copy = { ...user };
    delete (copy as { passwordHash?: string }).passwordHash;
    return copy;
  }

  async create(dto: CreateUserDto): Promise<Omit<User, 'passwordHash'>> {
    const existing = await this.userRepo.findOne({ where: { email: dto.email } });

    if (existing) {
      throw new ConflictException(`Email "${dto.email}" already registered`);
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = this.userRepo.create({
      email: dto.email,
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      role: dto.role,
      companyId: dto.companyId ?? null,
    });

    const saved = await this.userRepo.save(user);
    const { passwordHash: _, ...profile } = saved;
    return profile;
  }

  async update(id: string, dto: UpdateUserDto): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.userRepo.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException(`User with id "${id}" not found`);
    }

    Object.assign(user, dto);
    const saved = await this.userRepo.save(user);
    const { passwordHash: _, ...profile } = saved;
    return profile;
  }

  async changePassword(id: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException(`User with id "${id}" not found`);
    }

    const isMatch = await bcrypt.compare(dto.currentPassword, user.passwordHash);

    if (!isMatch) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    user.passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.userRepo.save(user);
  }
}
