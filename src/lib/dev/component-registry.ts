export type ComponentGalleryEntry = {
  description: string;
  /** Route param da tela de variantes (`/settings/components/[component]`). */
  id: string;
  title: string;
};

/**
 * Registro único da galeria dev (IBX-0072): a listagem em Configurações e a
 * rota dinâmica de variantes leem daqui. Componente novo = +1 entrada neste
 * array + uma seção de variantes na tela `[component]` — sem refazer
 * estrutura. Visível apenas com `EXPO_PUBLIC_IS_DEV=true` (mesmo gate do
 * simulatePayment no checkout).
 */
export const COMPONENT_GALLERY_ENTRIES: ComponentGalleryEntry[] = [
  {
    description: "Variantes do KPI para aprovação",
    id: "kpi",
    title: "KPI",
  },
  {
    description: "Papéis de texto para aprovação",
    id: "text",
    title: "Texto",
  },
  {
    description: "Rodapé flutuante de inscrição para aprovação",
    id: "join-footer",
    title: "Inscrição",
  },
  {
    description: "Gráfico de partidas por mês com crosshair para aprovação",
    id: "chart-crosshair",
    title: "Gráfico",
  },
];

export function findComponentGalleryEntry(
  id: null | string | string[] | undefined
): ComponentGalleryEntry | null {
  const normalized = Array.isArray(id) ? id[0] : id;

  return (
    COMPONENT_GALLERY_ENTRIES.find((entry) => entry.id === normalized) ?? null
  );
}
