type ChargeSource = {
  sourceId: string;
  sourceType: string;
};

const inFlight = new Map<string, Promise<unknown>>();

/**
 * UMA cobrança por inscrição. O reuso do servidor só enxerga a PENDING depois
 * do `saveCharge`, então duas criações para o mesmo source durante o mesmo voo
 * (chegar no checkout, voltar e tocar em Pagar de novo) chamariam a Woovi duas
 * vezes. Aqui o segundo pedido pega a promessa do primeiro em vez de criar.
 */
export function createChargeOnce<T extends { chargeId: string }>(
  source: ChargeSource,
  create: (source: ChargeSource) => Promise<T>
): Promise<T> {
  const key = `${source.sourceType}:${source.sourceId}`;
  const existing = inFlight.get(key) as Promise<T> | undefined;

  if (existing) {
    return existing;
  }

  const flight = create(source).finally(() => {
    inFlight.delete(key);
  });
  inFlight.set(key, flight);

  return flight;
}
