import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import {
  CreateUserDto,
  UpdateUserDto,
  AdminUpdateUserDto,
  UserFilterDto,
} from './dto';
import { PaginationDto } from '../../common/dto';
import { PaginatedResponse } from '../../common/interfaces';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const existingUser = await this.usersRepository.findOne({
      where: { email: createUserDto.email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(createUserDto.password, 12);

    const user = this.usersRepository.create({
      ...createUserDto,
      email: createUserDto.email.toLowerCase(),
      password: hashedPassword,
    });

    return this.usersRepository.save(user);
  }

  async findAll(
    pagination: PaginationDto,
    filters?: UserFilterDto,
  ): Promise<PaginatedResponse<User>> {
    const { page = 1, pageSize = 20 } = pagination;
    const skip = (page - 1) * pageSize;

    const where: FindOptionsWhere<User> = {};

    if (filters?.role) {
      where.role = filters.role;
    }

    if (filters?.country) {
      where.country = filters.country;
    }

    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters?.isVerified !== undefined) {
      where.isVerified = filters.isVerified;
    }

    const queryBuilder = this.usersRepository.createQueryBuilder('user');

    if (filters?.search) {
      queryBuilder.andWhere(
        '(user.firstName LIKE :search OR user.lastName LIKE :search OR user.email LIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    Object.entries(where).forEach(([key, value]) => {
      queryBuilder.andWhere(`user.${key} = :${key}`, { [key]: value });
    });

    const [users, total] = await queryBuilder
      .skip(skip)
      .take(pageSize)
      .orderBy('user.createdAt', 'DESC')
      .getManyAndCount();

    return {
      data: users,
      meta: {
        total,
        page,
        limit: pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { id },
    });
  }

  async findByIdOrFail(id: string): Promise<User> {
    const user = await this.findById(id);

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { email: email.toLowerCase() },
    });
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findByIdOrFail(id);

    Object.assign(user, updateUserDto);

    return this.usersRepository.save(user);
  }

  async adminUpdate(
    id: string,
    adminUpdateUserDto: AdminUpdateUserDto,
  ): Promise<User> {
    const user = await this.findByIdOrFail(id);

    Object.assign(user, adminUpdateUserDto);

    return this.usersRepository.save(user);
  }

  async remove(id: string): Promise<void> {
    const user = await this.findByIdOrFail(id);
    await this.usersRepository.remove(user);
  }

  async deactivate(id: string): Promise<User> {
    const user = await this.findByIdOrFail(id);
    user.isActive = false;
    return this.usersRepository.save(user);
  }

  async activate(id: string): Promise<User> {
    const user = await this.findByIdOrFail(id);
    user.isActive = true;
    return this.usersRepository.save(user);
  }

  async getProfile(userId: string): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      relations: ['clubs'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateProfile(
    userId: string,
    updateUserDto: UpdateUserDto,
  ): Promise<User> {
    return this.update(userId, updateUserDto);
  }

  async getStatistics(): Promise<{
    totalUsers: number;
    activeUsers: number;
    verifiedUsers: number;
    usersByRole: Record<string, number>;
    usersByCountry: Record<string, number>;
  }> {
    const totalUsers = await this.usersRepository.count();
    const activeUsers = await this.usersRepository.count({
      where: { isActive: true },
    });
    const verifiedUsers = await this.usersRepository.count({
      where: { isVerified: true },
    });

    const roleStats = await this.usersRepository
      .createQueryBuilder('user')
      .select('user.role', 'role')
      .addSelect('COUNT(*)', 'count')
      .groupBy('user.role')
      .getRawMany();

    const countryStats = await this.usersRepository
      .createQueryBuilder('user')
      .select('user.country', 'country')
      .addSelect('COUNT(*)', 'count')
      .groupBy('user.country')
      .orderBy('count', 'DESC')
      .limit(10)
      .getRawMany();

    return {
      totalUsers,
      activeUsers,
      verifiedUsers,
      usersByRole: roleStats.reduce(
        (acc, item) => ({ ...acc, [item.role]: parseInt(item.count, 10) }),
        {},
      ),
      usersByCountry: countryStats.reduce(
        (acc, item) => ({ ...acc, [item.country]: parseInt(item.count, 10) }),
        {},
      ),
    };
  }
}
