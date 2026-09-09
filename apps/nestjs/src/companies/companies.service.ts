import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { paginate, PaginatedResponse } from '../common/dto/paginated-response.dto.js';
import { CompanyQueryDto } from './dto/company-query.dto.js';
import { CreateCompanyDto } from './dto/create-company.dto.js';
import { UpdateCompanyDto } from './dto/update-company.dto.js';
import { Company, CompanyStatus } from './entities/company.entity.js';

@Injectable()
export class CompaniesService {
  constructor(
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
  ) {}

  async findAll(query: CompanyQueryDto): Promise<PaginatedResponse<Company>> {
    const where: Record<string, unknown> = {};

    if (query.status) {
      where['status'] = query.status;
    }

    if (query.search) {
      where['name'] = ILike(`%${query.search}%`);
    }

    const [data, total] = await this.companyRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: query.skip,
      take: query.limit,
    });

    return paginate(data, total, query.page, query.limit);
  }

  async findOne(id: string): Promise<Company> {
    const company = await this.companyRepo.findOne({ where: { id } });

    if (!company) {
      throw new NotFoundException(`Company with id "${id}" not found`);
    }

    return company;
  }

  async create(dto: CreateCompanyDto): Promise<Company> {
    const existing = await this.companyRepo.findOne({
      where: { code: dto.code },
    });

    if (existing) {
      throw new ConflictException(
        `Company with code "${dto.code}" already exists`,
      );
    }

    const company = this.companyRepo.create({
      ...dto,
      email: dto.email ?? null,
      phone: dto.phone ?? null,
      address: dto.address ?? null,
      city: dto.city ?? null,
      status: dto.status ?? CompanyStatus.ACTIVE,
    });

    return this.companyRepo.save(company);
  }

  async update(id: string, dto: UpdateCompanyDto): Promise<Company> {
    const company = await this.findOne(id);

    if (dto.code && dto.code !== company.code) {
      const existing = await this.companyRepo.findOne({
        where: { code: dto.code },
      });

      if (existing) {
        throw new ConflictException(
          `Company with code "${dto.code}" already exists`,
        );
      }
    }

    Object.assign(company, dto);
    return this.companyRepo.save(company);
  }

  async deactivate(id: string): Promise<Company> {
    const company = await this.findOne(id);
    company.status = CompanyStatus.INACTIVE;
    return this.companyRepo.save(company);
  }
}
