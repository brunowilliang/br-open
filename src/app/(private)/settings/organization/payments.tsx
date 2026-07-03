import { zodResolver } from "@hookform/resolvers/zod";
import {
  Alert02Icon,
  CheckmarkCircle02Icon,
  Edit02Icon,
  MoreVerticalIcon,
  Wallet01Icon,
} from "@hugeicons/core-free-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { useState } from "react";
import { View } from "react-native";
import { z } from "zod";

import { Page } from "@/components/core/NewPage";
import { Text } from "@/components/core/text";
import { HugeIcons } from "@/components/ui/huge-icons";
import { LoadingState } from "@/components/ui/loading-state";
import { useCRPC } from "@/lib/convex/crpc";
import { getToastErrorMessage } from "@/lib/errors/toast-message";
import {
  Button,
  Card,
  Description,
  FieldError,
  Input,
  Label,
  Menu,
  Spinner,
  useToast,
} from "heroui-native";

const connectSchema = z.object({
  pixKey: z.string().min(1, "Informe a chave PIX."),
});

type ConnectFormValues = z.infer<typeof connectSchema>;

export default function PaymentsRoute() {
  const crpc = useCRPC();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);

  const statusQuery = useQuery(
    crpc.payment.onboarding.getStatus.queryOptions()
  );

  const startOnboarding = useMutation(
    crpc.payment.onboarding.start.mutationOptions({
      onError: (error) => {
        toast.show({
          description: getToastErrorMessage(
            error,
            "Não foi possível conectar a conta."
          ),
          id: "payment-onboarding-error",
          label: "Erro ao conectar conta",
          variant: "danger",
        });
      },
      onSuccess: async () => {
        toast.show({
          description: isEditing ? "Chave PIX atualizada" : "Conta conectada",
          id: "payment-onboarding-success",
          label: isEditing ? "Chave atualizada" : "Conta conectada",
          variant: "success",
        });
        setIsEditing(false);
        await queryClient.invalidateQueries(
          crpc.payment.onboarding.getStatus.queryFilter()
        );
      },
    })
  );

  const form = useForm<ConnectFormValues>({
    defaultValues: { pixKey: "" },
    resolver: zodResolver(connectSchema),
  });

  const onSubmit = form.handleSubmit(async (values) => {
    await startOnboarding.mutateAsync({ pixKey: values.pixKey });
  });

  function handleEditPixKey() {
    setIsEditing(true);
    form.reset({ pixKey: "" });
  }

  function handleCancelEdit() {
    setIsEditing(false);
    form.reset({ pixKey: "" });
  }

  const account = statusQuery.data ?? null;
  const isConnected = account?.status === "active";
  const showEditForm = isEditing && isConnected;

  return (
    <Page>
      <Page.Header>
        <Page.Header.Left>
          <Page.Header.BackButton />
        </Page.Header.Left>
        <Page.Header.Center>
          <Page.Header.Title>Pagamentos</Page.Header.Title>
        </Page.Header.Center>
        <Page.Header.Right />
      </Page.Header>

      <Page.ScrollView contentContainerClassName="gap-4 px-4 pb-safe-offset-4">
        {statusQuery.isPending ? (
          <LoadingState />
        ) : showEditForm ? (
          <Card className="gap-4">
            <Card.Body className="gap-2">
              <Text variant="title" weight="semibold">
                Editar chave PIX
              </Text>
              <Description>
                Digite a nova chave PIX que receberá os pagamentos das suas
                ligas.
              </Description>

              <Controller
                control={form.control}
                name="pixKey"
                render={({ field, fieldState }) => (
                  <View className="gap-1">
                    <Label>Nova chave PIX</Label>
                    <Input
                      autoCapitalize="none"
                      className="w-full"
                      editable={!startOnboarding.isPending}
                      isInvalid={Boolean(fieldState.error)}
                      onBlur={field.onBlur}
                      onChangeText={field.onChange}
                      placeholder="Ex.: seu e-mail, CPF, telefone ou chave aleatória"
                      value={String(field.value ?? "")}
                      variant="secondary"
                    />
                    <FieldError>{fieldState.error?.message ?? ""}</FieldError>
                  </View>
                )}
              />
            </Card.Body>

            <View className="flex-row gap-2">
              <Button
                className="flex-1"
                isDisabled={startOnboarding.isPending}
                onPress={() => handleCancelEdit()}
                variant="secondary"
              >
                <Button.Label>Cancelar</Button.Label>
              </Button>
              <Button
                className="flex-1"
                isDisabled={startOnboarding.isPending}
                onPress={() => onSubmit().catch(() => undefined)}
              >
                <Button.Label>
                  {startOnboarding.isPending ? "Salvando..." : "Salvar chave"}
                </Button.Label>
              </Button>
            </View>
          </Card>
        ) : isConnected ? (
          <Card className="border border-success-soft bg-success-soft">
            <Card.Body className="gap-3">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2">
                  <HugeIcons
                    className="size-5 text-success"
                    icon={CheckmarkCircle02Icon}
                  />
                  <Text className="text-success" weight="semibold">
                    Conta conectada
                  </Text>
                </View>
                <Menu>
                  <Menu.Trigger asChild>
                    <Button isIconOnly size="sm" variant="ghost">
                      <HugeIcons icon={MoreVerticalIcon} />
                    </Button>
                  </Menu.Trigger>
                  <Menu.Portal>
                    <Menu.Overlay className="bg-backdrop" />
                    <Menu.Content presentation="popover">
                      <Menu.Item onPress={handleEditPixKey}>
                        <Menu.ItemTitle className="flex-none">
                          Editar chave PIX
                        </Menu.ItemTitle>
                        <HugeIcons icon={Edit02Icon} />
                      </Menu.Item>
                    </Menu.Content>
                  </Menu.Portal>
                </Menu>
              </View>
              {account?.name ? (
                <Text weight="semibold">{account.name}</Text>
              ) : null}
              {account?.wooviPixKey ? (
                <View className="gap-1">
                  <Text color="muted" variant="description">
                    Chave PIX
                  </Text>
                  <Text className="font-mono">{account.wooviPixKey}</Text>
                </View>
              ) : null}
              <Description>
                Os pagamentos das suas ligas serão recebidos automaticamente
                nesta conta via PIX.
              </Description>
            </Card.Body>
          </Card>
        ) : account?.status === "pending" ? (
          <Card className="gap-3">
            <Card.Body className="items-center gap-3 py-6">
              <Spinner />
              <Text variant="title" weight="semibold">
                Validando conta…
              </Text>
              <Description className="text-center">
                A validação da conta leva alguns instantes. Mantenha o app
                aberto — avisaremos quando estiver tudo pronto.
              </Description>
            </Card.Body>
          </Card>
        ) : (
          <Card className="gap-4">
            <Card.Body className="gap-2">
              <View className="flex-row items-center gap-2">
                <View className="centered size-10 rounded-2xl bg-accent-soft">
                  <HugeIcons
                    className="size-5 text-accent"
                    icon={Wallet01Icon}
                  />
                </View>
                <Text variant="title" weight="semibold">
                  Receba pagamentos nas suas ligas
                </Text>
              </View>
              <Description>
                Quando um jogador paga por uma liga, o valor é dividido — você
                recebe sua parte automaticamente via PIX.
              </Description>

              {account?.status === "rejected" ? (
                <View className="flex-row items-center gap-2">
                  <HugeIcons
                    className="size-4 text-danger"
                    icon={Alert02Icon}
                  />
                  <Text className="text-danger" variant="description">
                    Conta rejeitada. Tente conectar novamente.
                  </Text>
                </View>
              ) : null}

              <Controller
                control={form.control}
                name="pixKey"
                render={({ field, fieldState }) => (
                  <View className="gap-1">
                    <Label>Chave PIX</Label>
                    <Input
                      autoCapitalize="none"
                      className="w-full"
                      editable={!startOnboarding.isPending}
                      isInvalid={Boolean(fieldState.error)}
                      onBlur={field.onBlur}
                      onChangeText={field.onChange}
                      placeholder="Ex.: seu e-mail, CPF, telefone ou chave aleatória"
                      value={String(field.value ?? "")}
                      variant="secondary"
                    />
                    <FieldError>{fieldState.error?.message ?? ""}</FieldError>
                  </View>
                )}
              />
            </Card.Body>

            <Button
              className="w-full"
              isDisabled={startOnboarding.isPending}
              onPress={() => onSubmit().catch(() => undefined)}
            >
              <Button.Label>
                {startOnboarding.isPending ? "Conectando..." : "Conectar conta"}
              </Button.Label>
            </Button>
          </Card>
        )}
      </Page.ScrollView>
    </Page>
  );
}
