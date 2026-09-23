export type ComponentGalleryEntry = {
  description: string;
  /** Route param da tela de variantes (`/settings/components/[component]`). */
  id: string;
  title: string;
};

/**
 * Registro único da galeria dev: a listagem em Configurações e a rota dinâmica
 * de variantes leem daqui — componente novo pede +1 entrada neste array e uma
 * seção de variantes na tela `[component]`.
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
  {
    description: "Alertas e pendências por caso de uso para aprovação",
    id: "alerts",
    title: "Alertas",
  },
  {
    description: "Todos os tipos de notificação para aprovação",
    id: "notifications",
    title: "Notificações",
  },
  {
    description: "Card de partida (agenda e chave) por estado para aprovação",
    id: "match-card",
    title: "Partida",
  },
  {
    description: "Card de inscrição por estado para aprovação",
    id: "entry-card",
    title: "Inscrições",
  },
  {
    description: "Linha de conta vinculada por estado, com o status em chip",
    id: "linked-account",
    title: "Contas vinculadas",
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
