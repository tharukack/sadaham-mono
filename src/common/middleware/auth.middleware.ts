import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../utils/prisma.service';
import { Request, Response, NextFunction } from 'express';
import { clearAuthCookie, getAuthTokenFromRequest } from '../../auth/auth-cookie';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const token = getAuthTokenFromRequest(req);
    if (token) {
      try {
        const payload = await this.jwt.verifyAsync(token, {
          secret: this.config.get<string>('JWT_SECRET'),
        });
        if (payload?.sub && payload?.sessionId) {
          const session = await this.prisma.userSession.findFirst({
            where: { id: payload.sessionId, userId: payload.sub, revokedAt: null },
          });
          if (!session) {
            clearAuthCookie(res, this.config);
            next();
            return;
          }
          const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
          if (user) {
            if (!user.isActive) {
              await this.prisma.userSession.updateMany({
                where: { id: payload.sessionId, revokedAt: null },
                data: { revokedAt: new Date() },
              });
              clearAuthCookie(res, this.config);
              throw new UnauthorizedException('User is inactive');
            }
            const rawPath = (req.originalUrl || req.url || req.path || '').split('?')[0];
            const isChangePasswordRoute =
              rawPath === '/auth/change-password' ||
              rawPath === '/change-password' ||
              rawPath.endsWith('/auth/change-password') ||
              rawPath.endsWith('/change-password');
            const isLogoutRoute =
              rawPath === '/auth/logout' ||
              rawPath === '/logout' ||
              rawPath.endsWith('/auth/logout') ||
              rawPath.endsWith('/logout');
            const isSessionRoute =
              rawPath === '/auth/me' ||
              rawPath === '/me' ||
              rawPath.endsWith('/auth/me') ||
              rawPath.endsWith('/me');
            if (!user.mustChangePassword || isChangePasswordRoute || isLogoutRoute || isSessionRoute) {
              // Attach authenticated user to request for downstream guards/controllers
              (req as any).user = user;
              (req as any).sessionId = payload.sessionId;
            }
          }
        }
      } catch (err) {
        clearAuthCookie(res, this.config);
        if (err instanceof UnauthorizedException) {
          throw err;
        }
        // Ignore verification errors; downstream guards will handle missing user
      }
    }
    next();
  }
}
