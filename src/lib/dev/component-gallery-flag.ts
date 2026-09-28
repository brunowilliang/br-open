/**
 * Marca DEDICADA da galeria de componentes (a listagem e as rotas
 * `/settings/components/*`). Existe separada de `EXPO_PUBLIC_IS_DEV` porque a
 * galeria também precisa abrir em pacote de produção (aprovação de layout no
 * TestFlight) sem ligar os atalhos de desenvolvimento.
 */
export const isComponentGalleryEnabled =
  process.env.EXPO_PUBLIC_COMPONENT_GALLERY === "true";
