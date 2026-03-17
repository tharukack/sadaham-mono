import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';

export const AUTH_COOKIE_NAME = 'auth_token';

function isSecureCookie(config: ConfigService) {
  const siteAddress = config.get<string>('SITE_ADDRESS') || config.get<string>('PUBLIC_URL') || '';
  try {
    return new URL(siteAddress).protocol === 'https:';
  } catch {
    return false;
  }
}

export function setAuthCookie(res: Response, token: string, config: ConfigService) {
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isSecureCookie(config),
    path: '/',
    maxAge: 12 * 60 * 60 * 1000,
  });
}

export function clearAuthCookie(res: Response, config: ConfigService) {
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isSecureCookie(config),
    path: '/',
  });
}

export function getAuthTokenFromRequest(req: Request) {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    return auth.slice(7);
  }

  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(';');
  for (const cookie of cookies) {
    const [rawName, ...rawValueParts] = cookie.trim().split('=');
    if (rawName === AUTH_COOKIE_NAME) {
      return decodeURIComponent(rawValueParts.join('='));
    }
  }

  return null;
}
