import type { ForwardedRef, ReactNode } from "react";
import type { FlatList } from "react-native";
import BaseDraggableFlatList, {
  ScaleDecorator as BaseScaleDecorator,
  type DraggableFlatListProps,
  type RenderItemParams as BaseRenderItemParams,
} from "react-native-draggable-flatlist";
import { withUniwind } from "uniwind";

export const ScaleDecorator = BaseScaleDecorator;

export type RenderItemParams<T> = BaseRenderItemParams<T>;

export type DraggableFlatListClassNameProps = {
  className?: string;
  columnWrapperClassName?: string;
  containerClassName?: string;
  contentContainerClassName?: string;
  endFillColorClassName?: string;
  ListFooterComponentClassName?: string;
  ListHeaderComponentClassName?: string;
};

export type UniwindDraggableFlatListProps<T> = DraggableFlatListProps<T> &
  DraggableFlatListClassNameProps;

const DraggableFlatListWithUniwind = withUniwind(BaseDraggableFlatList, {
  columnWrapperStyle: { fromClassName: "columnWrapperClassName" },
  containerStyle: { fromClassName: "containerClassName" },
  contentContainerStyle: { fromClassName: "contentContainerClassName" },
  endFillColor: {
    fromClassName: "endFillColorClassName",
    styleProperty: "accentColor",
  },
  ListFooterComponentStyle: { fromClassName: "ListFooterComponentClassName" },
  ListHeaderComponentStyle: { fromClassName: "ListHeaderComponentClassName" },
  style: { fromClassName: "className" },
});

const DraggableFlatList = DraggableFlatListWithUniwind as <T>(
  props: UniwindDraggableFlatListProps<T> & {
    ref?: ForwardedRef<FlatList<T>>;
  }
) => ReactNode;

export default DraggableFlatList;
