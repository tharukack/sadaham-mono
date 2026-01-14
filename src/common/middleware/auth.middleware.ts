import { Injectable, NestMiddleware } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../utils/prisma.service';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const auth = req.headers.authorization;
    if (auth?.startsWith('Bearer ')) {
      const token = auth.slice(7);
      try {
        const payload = await this.jwt.verifyAsync(token, {
          secret: this.config.get<string>('JWT_SECRET'),
        });
        if (payload?.sub) {
          const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
          if (user) {
            // Attach authenticated user to request for downstream guards/controllers
            (req as any).user = user;
          }
        }
      } catch {
        // Ignore verification errors; downstream guards will handle missing user
      }
    }
    next();
  }
}
