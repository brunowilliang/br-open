import type { ComponentType } from "react";

import { AlertsVariantsSection } from "@/components/pages/settings/alerts";
import { CategoryEditorVariantsSection } from "@/components/pages/settings/category-editor";
import { CategorySelectVariantsSection } from "@/components/pages/settings/category-select";
import { ChartCrosshairGallerySection } from "@/components/pages/settings/chart-crosshair";
import { EntryCardVariantsSection } from "@/components/pages/settings/entry-card";
import { JoinFooterVariantsSection } from "@/components/pages/settings/join-footer";
import { KpiVariantsSection } from "@/components/pages/settings/kpi";
import { LinkedAccountRowVariantsSection } from "@/components/pages/settings/linked-account";
import { MatchCardVariantsSection } from "@/components/pages/settings/match-card";
import { NotificationVariantsSection } from "@/components/pages/settings/notifications";
import { CheckoutStatusVariantsSection } from "@/components/pages/settings/payment-status";
import { StandingsCardVariantsSection } from "@/components/pages/settings/standings-card";
import { TextVariantsSection } from "@/components/pages/settings/text";
import { TournamentStatusVariantsSection } from "@/components/pages/settings/tournament-status";

/**
 * Mapa id do registry -> página de variantes da rota `[component]`; componente
 * novo pede +1 entrada no registry e +1 pasta em `settings/<id>/`.
 */
export const COMPONENT_GALLERY_SECTIONS: Record<string, ComponentType> = {
  alerts: AlertsVariantsSection,
  "category-editor": CategoryEditorVariantsSection,
  "category-select": CategorySelectVariantsSection,
  "chart-crosshair": ChartCrosshairGallerySection,
  "entry-card": EntryCardVariantsSection,
  "join-footer": JoinFooterVariantsSection,
  kpi: KpiVariantsSection,
  "linked-account": LinkedAccountRowVariantsSection,
  "match-card": MatchCardVariantsSection,
  notifications: NotificationVariantsSection,
  "payment-status": CheckoutStatusVariantsSection,
  "standings-card": StandingsCardVariantsSection,
  text: TextVariantsSection,
  "tournament-status": TournamentStatusVariantsSection,
};
