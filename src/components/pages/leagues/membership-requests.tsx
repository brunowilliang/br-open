import { Button, ListGroup, Separator } from "heroui-native";
import { Fragment } from "react";

import { Image } from "@/components/core/image";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { HugeIcons } from "@/components/ui/huge-icons";
import { LoadingState } from "@/components/ui/loading-state";
import { Cancel01Icon, Tick02Icon } from "@hugeicons/core-free-icons";

export type MembershipRequestItem = {
  avatarUrl?: string | null;
  id: string;
  name: string;
  nickname: string;
};

type MembershipRequestsProps = {
  errorMessage?: string;
  isLoading?: boolean;
  isPending?: boolean;
  items: MembershipRequestItem[];
  onApprove: (membershipId: string) => void;
  onReject: (membershipId: string) => void;
};

export const MembershipRequests = (props: MembershipRequestsProps) => {
  const { errorMessage, isLoading, isPending, items, onApprove, onReject } =
    props;

  if (isLoading) {
    return <LoadingState />;
  }

  if (errorMessage) {
    return <ErrorState message={errorMessage} />;
  }

  if (items.length === 0) {
    return (
      <EmptyState
        description="Quando alguém solicitar entrada, ela aparecerá aqui."
        title="Nenhuma solicitação pendente"
      />
    );
  }

  return (
    <ListGroup>
      {items.map((item, index) => (
        <Fragment key={item.id}>
          {index > 0 ? <Separator className="mx-4" /> : null}
          <ListGroup.Item disabled>
            <ListGroup.ItemPrefix>
              <Image
                className="size-10 rounded-full"
                fallback="blue"
                source={item.avatarUrl ? { uri: item.avatarUrl } : undefined}
              />
            </ListGroup.ItemPrefix>
            <ListGroup.ItemContent>
              <ListGroup.ItemTitle numberOfLines={1}>
                {item.name}
              </ListGroup.ItemTitle>
              <ListGroup.ItemDescription numberOfLines={1}>
                {item.nickname}
              </ListGroup.ItemDescription>
            </ListGroup.ItemContent>
            <ListGroup.ItemSuffix className="flex-row gap-1">
              <Button
                isDisabled={isPending}
                isIconOnly
                onPress={() => {
                  onReject(item.id);
                }}
                size="sm"
                variant="outline"
              >
                <HugeIcons icon={Cancel01Icon} />
              </Button>
              <Button
                isDisabled={isPending}
                isIconOnly
                onPress={() => {
                  onApprove(item.id);
                }}
                size="sm"
              >
                <HugeIcons
                  className="text-accent-foreground"
                  icon={Tick02Icon}
                />
              </Button>
            </ListGroup.ItemSuffix>
          </ListGroup.Item>
        </Fragment>
      ))}
    </ListGroup>
  );
};
