import { Button, ListGroup, Separator } from "heroui-native";
import { EmptyState } from "heroui-native-pro";
import { Fragment } from "react";

import { Image } from "@/components/core/image";

export type MembershipRequestItem = {
  avatarUrl?: string | null;
  id: string;
  name: string;
  nickname: string;
};

type MembershipRequestsProps = {
  isPending?: boolean;
  items: MembershipRequestItem[];
  onApprove: (membershipId: string) => void;
  onReject: (membershipId: string) => void;
};

export const MembershipRequests = (props: MembershipRequestsProps) => {
  const { isPending, items, onApprove, onReject } = props;

  if (items.length === 0) {
    return (
      <EmptyState className="gap-3.5 p-2">
        <EmptyState.Header>
          <EmptyState.Title>Nenhuma solicitação pendente</EmptyState.Title>
          <EmptyState.Description>
            Quando alguém solicitar entrada, ela aparecerá aqui.
          </EmptyState.Description>
        </EmptyState.Header>
      </EmptyState>
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
              <ListGroup.ItemTitle>{item.name}</ListGroup.ItemTitle>
              <ListGroup.ItemDescription>
                {item.nickname}
              </ListGroup.ItemDescription>
            </ListGroup.ItemContent>
            <ListGroup.ItemSuffix className="flex-row gap-2">
              <Button
                isDisabled={isPending}
                onPress={() => {
                  onReject(item.id);
                }}
                size="sm"
                variant="outline"
              >
                <Button.Label>Reprovar</Button.Label>
              </Button>
              <Button
                isDisabled={isPending}
                onPress={() => {
                  onApprove(item.id);
                }}
                size="sm"
              >
                <Button.Label>Aprovar</Button.Label>
              </Button>
            </ListGroup.ItemSuffix>
          </ListGroup.Item>
        </Fragment>
      ))}
    </ListGroup>
  );
};
