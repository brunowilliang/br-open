const VIA_CEP_BASE = "https://viacep.com.br/ws";

export type ViaCepResult = {
  cep: string;
  street: string;
  district: string;
  city: string;
  state: string;
};

export class ViaCepNotFoundError extends Error {
  constructor() {
    super("CEP não encontrado.");
  }
}

export class ViaCepFetchError extends Error {
  constructor() {
    super("Não foi possível buscar o CEP.");
  }
}

function sanitizeCep(cep: string) {
  return cep.replace(/\D/g, "");
}

export async function fetchAddressByCep(rawCep: string): Promise<ViaCepResult> {
  const cep = sanitizeCep(rawCep);

  if (cep.length !== 8) {
    throw new ViaCepFetchError();
  }

  let response: Response;

  try {
    response = await fetch(`${VIA_CEP_BASE}/${cep}/json/`);
  } catch {
    throw new ViaCepFetchError();
  }

  if (!response.ok) {
    throw new ViaCepFetchError();
  }

  let body: unknown;

  try {
    body = await response.json();
  } catch {
    throw new ViaCepFetchError();
  }

  if (
    typeof body !== "object" ||
    body === null ||
    "erro" in body ||
    !("localidade" in body) ||
    !("uf" in body)
  ) {
    throw new ViaCepNotFoundError();
  }

  const data = body as Record<string, string>;

  return {
    cep: data.cep ?? rawCep,
    city: data.localidade ?? "",
    district: data.bairro ?? "",
    state: data.uf ?? "",
    street: data.logradouro ?? "",
  };
}
