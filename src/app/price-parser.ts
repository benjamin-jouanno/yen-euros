export function extractYenPrices(text: string): number[] {
  const normalizedText = text.normalize("NFKC");
  const matches = [
    ...normalizedText.matchAll(/(?:¥|￥|JPY|YEN)\s*([0-9][0-9,]*(?:\.[0-9]+)?)/gi),
    ...normalizedText.matchAll(/([0-9][0-9,]*(?:\.[0-9]+)?)\s*円/g),
  ];
  const prices = new Set<number>();

  for (const match of matches) {
    const value = Number(match[1].replaceAll(",", ""));
    if (Number.isSafeInteger(value) && value > 0 && value <= 100_000_000) {
      prices.add(value);
    }
  }

  return [...prices].sort((first, second) => first - second);
}
