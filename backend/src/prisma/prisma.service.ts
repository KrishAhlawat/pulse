import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { LoggerService } from '../logger/logger.service';
import { LOG_CONTEXTS } from '../logger/logger.constants';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly logger: LoggerService) {
    super();
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.info('Database connected', LOG_CONTEXTS.PRISMA);
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
