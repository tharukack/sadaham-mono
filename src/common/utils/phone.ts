export function normalizeAuMobile(input: string): string {
  if (!input) return input;
  const trimmed = input.trim();
  if (!trimmed) return trimmed;
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return '';

  if (digits.startsWith('61')) {
    const rest = digits.slice(2);
    if (rest.startsWith('0')) {
      return rest;
    }
    if (rest.length === 9) {
      return `0${rest}`;
    }
    return rest;
  }

  if (digits.length === 9 && digits.startsWith('4')) {
    return `0${digits}`;
  }

  return digits;
}

export function toE164AuMobile(input: string): string {
  const normalized = normalizeAuMobile(input);
  if (!normalized) return normalized;

  if (normalized.startsWith('+')) {
    return normalized;
  }

  if (normalized.startsWith('0') && normalized.length === 10) {
    return `+61${normalized.slice(1)}`;
  }

  if (normalized.length === 9 && normalized.startsWith('4')) {
    return `+61${normalized}`;
  }

  if (normalized.startsWith('61')) {
    return `+${normalized}`;
  }

  return normalized;
}
