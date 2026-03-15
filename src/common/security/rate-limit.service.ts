import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

type LimitOptions = {
  limit: number;
  windowMs: number;
  blockMs: number;
  message: string;
};

type Entry = {
  count: number;
  windowStartedAt: number;
  blockedUntil: number;
};

@Injectable()
export class RateLimitService {
  private readonly entries = new Map<string, Entry>();

  assertAllowed(key: string, options: LimitOptions) {
    const now = Date.now();
    const existing = this.entries.get(key);

    if (existing?.blockedUntil && existing.blockedUntil > now) {
      throw new HttpException(options.message, HttpStatus.TOO_MANY_REQUESTS);
    }

    const inWindow =
      existing && now - existing.windowStartedAt < options.windowMs;

    const next: Entry = inWindow
      ? {
          count: existing.count + 1,
          windowStartedAt: existing.windowStartedAt,
          blockedUntil: 0,
        }
      : {
          count: 1,
          windowStartedAt: now,
          blockedUntil: 0,
        };

    if (next.count > options.limit) {
      next.blockedUntil = now + options.blockMs;
      this.entries.set(key, next);
      throw new HttpException(options.message, HttpStatus.TOO_MANY_REQUESTS);
    }

    this.entries.set(key, next);
  }

  reset(key: string) {
    this.entries.delete(key);
  }
}
