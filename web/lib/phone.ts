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

export function formatAuMobile(input: string): string {
  const normalized = normalizeAuMobile(input);
  if (!normalized) return normalized;

  const digits = normalized.replace(/\D/g, '');
  if (digits.length === 10 && digits.startsWith('0')) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }

  return normalized;
}
