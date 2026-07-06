import { zodResolver } from "@hookform/resolvers/zod";
import {
  CheckmarkCircle02Icon,
  Edit02Icon,
  MoreVerticalIcon,
  Wallet01Icon,
} from "@hugeicons/core-free-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { View } from "react-native";
import { z } from "zod";

import { Page } from "@/components/core/NewPage";
import { HugeIcons } from "@/components/ui/huge-icons";
import { LoadingState } from "@/components/ui/loading-state";
import { SelectOptionItem } from "@/components/ui/select-option-item";
import { useCRPC } from "@/lib/convex/crpc";
import { getToastErrorMessage } from "@/lib/errors/toast-message";
import {
  PIX_KEY_TYPES,
  applyPixInputChange,
  formatPixKey,
  isNumericPixKey,
  isValidPixKey,
  rawPixKey,
  type PixKeyType,
} from "@/lib/payments/pix-key";
import {
  Button,
  Card,
  Description,
  FieldError,
  Input,
  Label,
  Menu,
  Select,
  Spinner,
  TextField,
  useToast,
} from "heroui-native";

type ConnectFormValues = {
  pixKey: string;
  pixKeyType: PixKeyType;
};

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
    defaultValues: { pixKey: "", pixKeyType: "cpf" },
    resolver: zodResolver(
      z.object({
        pixKey: z.string().min(1, "Informe a chave PIX."),
        pixKeyType: z.custom<PixKeyType>(
          (v) => v !== undefined && v !== null && v !== ""
        ),
      })
    ),
  });

  const onSubmit = form.handleSubmit(async (values) => {
    if (!isValidPixKey(values.pixKey, values.pixKeyType)) {
      form.setError("pixKey", {
        message: "Chave PIX inválida para o tipo selecionado.",
      });
      return;
    }
    const raw = rawPixKey(values.pixKey, values.pixKeyType);
    await startOnboarding.mutateAsync({ pixKey: raw });
  });

  function handleEditPixKey() {
    setIsEditing(true);
    form.reset({ pixKey: "", pixKeyType: "cpf" });
  }

  function handleCancelEdit() {
    setIsEditing(false);
    form.reset({ pixKey: "", pixKeyType: "cpf" });
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
          <Card className="gap-5">
            <Card.Header>
              <Card.Title>Editar chave PIX</Card.Title>
              <Card.Description>
                Digite a nova chave PIX que receberá os pagamentos das suas
                ligas.
              </Card.Description>
            </Card.Header>
            <Card.Body className="gap-2">
              <Controller
                control={form.control}
                name="pixKeyType"
                render={({ field: typeField }) => (
                  <TextField isRequired>
                    <Label>Tipo de chave</Label>
                    <Select
                      onValueChange={(nextValue) => {
                        if (nextValue && !Array.isArray(nextValue)) {
                          typeField.onChange(nextValue.value as PixKeyType);
                          form.setValue("pixKey", "");
                        }
                      }}
                      selectionMode="single"
                      value={{
                        label:
                          PIX_KEY_TYPES.find((o) => o.value === typeField.value)
                            ?.label ?? "CPF",
                        value: (typeField.value as string) ?? "cpf",
                      }}
                    >
                      <Select.Trigger className="bg-surface-secondary">
                        <Select.Value
                          className="font-normal"
                          numberOfLines={1}
                          placeholder="Escolha um tipo"
                        />
                        <Select.TriggerIndicator />
                      </Select.Trigger>
                      <Select.Portal>
                        <Select.Overlay />
                        <Select.Content presentation="popover" width="trigger">
                          <Select.ListLabel className="mb-2">
                            Escolha um tipo
                          </Select.ListLabel>
                          {PIX_KEY_TYPES.map((option) => (
                            <SelectOptionItem
                              key={option.value}
                              label={option.label}
                              value={option.value}
                            />
                          ))}
                        </Select.Content>
                      </Select.Portal>
                    </Select>
                  </TextField>
                )}
              />

              <Controller
                control={form.control}
                name="pixKey"
                render={({ field, fieldState }) => (
                  <TextField isRequired>
                    <Label>Chave PIX</Label>
                    <Input
                      autoCapitalize="none"
                      className="w-full"
                      isInvalid={Boolean(fieldState.error)}
                      keyboardType={
                        isNumericPixKey(form.getValues("pixKeyType"))
                          ? "numeric"
                          : "default"
                      }
                      onBlur={field.onBlur}
                      onChangeText={(text) => {
                        const formType = form.getValues("pixKeyType");
                        const prev = String(field.value ?? "");
                        const digits = applyPixInputChange(
                          prev,
                          text,
                          formType
                        );
                        field.onChange(formatPixKey(digits, formType));
                      }}
                      placeholder="Digite sua chave PIX"
                      value={String(field.value ?? "")}
                      variant="secondary"
                    />
                    <FieldError>{fieldState.error?.message ?? ""}</FieldError>
                  </TextField>
                )}
              />
            </Card.Body>

            <Card.Footer className="flex-row gap-2">
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
            </Card.Footer>
          </Card>
        ) : isConnected ? (
          <Card className="gap-5 bg-success-soft">
            <Card.Header>
              <View className="flex-row items-center gap-2">
                <Card.Title className="text-success">
                  Conta conectada
                </Card.Title>
                <HugeIcons
                  className="text-success"
                  icon={CheckmarkCircle02Icon}
                />
              </View>
              <Card.Description className="text-success">
                Sua conta está conectada e pronta para receber pagamentos via
                PIX!
              </Card.Description>
            </Card.Header>
            <Menu className="absolute top-2 right-2">
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
            <Card.Body className="gap-2">
              {account?.name ? (
                <TextField>
                  <Description>Nome da conta</Description>
                  <Label>{account.name}</Label>
                </TextField>
              ) : null}
              {account?.pixKey ? (
                <TextField>
                  <Description>Chave PIX</Description>
                  <Label>{account.pixKey}</Label>
                </TextField>
              ) : null}
            </Card.Body>

            <Card.Footer className="flex-row gap-2">
              <Card.Description>
                Os pagamentos das suas ligas serão recebidos automaticamente
                nesta conta via PIX.
              </Card.Description>
            </Card.Footer>
          </Card>
        ) : account?.status === "pending" ? (
          <Card className="gap-5">
            <Card.Header>
              <View className="flex-row items-center gap-2">
                <Spinner size="sm" />
                <Card.Title>Validando conta…</Card.Title>
              </View>
              <Card.Description>
                A validação da conta leva alguns instantes. Mantenha o app
                aberto — avisaremos quando estiver tudo pronto.
              </Card.Description>
            </Card.Header>
          </Card>
        ) : (
          <Card className="gap-5">
            <Card.Header>
              <View className="flex-row items-center gap-2">
                <View className="centered size-10 rounded-2xl bg-accent-soft">
                  <HugeIcons
                    className="size-5 text-accent"
                    icon={Wallet01Icon}
                  />
                </View>
                <View>
                  <Card.Title>Receba pagamentos nas suas ligas</Card.Title>
                  <Card.Description>
                    Quando um jogador paga por uma liga, o valor é dividido —
                    você recebe sua parte automaticamente via PIX.
                  </Card.Description>
                </View>
              </View>
              {account?.status === "rejected" ? (
                <Card.Description className="text-danger">
                  Conta rejeitada. Tente conectar novamente.
                </Card.Description>
              ) : null}
            </Card.Header>
            <Card.Body className="gap-2">
              <Controller
                control={form.control}
                name="pixKeyType"
                render={({ field: typeField }) => (
                  <TextField isRequired>
                    <Label>Tipo de chave</Label>
                    <Select
                      onValueChange={(nextValue) => {
                        if (nextValue && !Array.isArray(nextValue)) {
                          typeField.onChange(nextValue.value as PixKeyType);
                          form.setValue("pixKey", "");
                        }
                      }}
                      selectionMode="single"
                      value={{
                        label:
                          PIX_KEY_TYPES.find((o) => o.value === typeField.value)
                            ?.label ?? "CPF",
                        value: (typeField.value as string) ?? "cpf",
                      }}
                    >
                      <Select.Trigger className="bg-surface-secondary">
                        <Select.Value
                          className="font-normal"
                          numberOfLines={1}
                          placeholder="Escolha um tipo"
                        />
                        <Select.TriggerIndicator />
                      </Select.Trigger>
                      <Select.Portal>
                        <Select.Overlay />
                        <Select.Content presentation="popover" width="trigger">
                          <Select.ListLabel className="mb-2">
                            Escolha um tipo
                          </Select.ListLabel>
                          {PIX_KEY_TYPES.map((option) => (
                            <SelectOptionItem
                              key={option.value}
                              label={option.label}
                              value={option.value}
                            />
                          ))}
                        </Select.Content>
                      </Select.Portal>
                    </Select>
                  </TextField>
                )}
              />

              <Controller
                control={form.control}
                name="pixKey"
                render={({ field, fieldState }) => (
                  <TextField isRequired>
                    <Label>Chave PIX</Label>
                    <Input
                      autoCapitalize="none"
                      className="w-full"
                      isInvalid={Boolean(fieldState.error)}
                      keyboardType={
                        isNumericPixKey(form.getValues("pixKeyType"))
                          ? "numeric"
                          : "default"
                      }
                      onBlur={field.onBlur}
                      onChangeText={(text) => {
                        const formType = form.getValues("pixKeyType");
                        const prev = String(field.value ?? "");
                        const digits = applyPixInputChange(
                          prev,
                          text,
                          formType
                        );
                        field.onChange(formatPixKey(digits, formType));
                      }}
                      placeholder="Digite sua chave PIX"
                      value={String(field.value ?? "")}
                      variant="secondary"
                    />
                    <FieldError>{fieldState.error?.message ?? ""}</FieldError>
                  </TextField>
                )}
              />
            </Card.Body>

            <Card.Footer>
              <Button
                className="w-full"
                isDisabled={startOnboarding.isPending}
                onPress={() => onSubmit().catch(() => undefined)}
              >
                <Button.Label>
                  {startOnboarding.isPending
                    ? "Conectando..."
                    : "Conectar conta"}
                </Button.Label>
              </Button>
            </Card.Footer>
          </Card>
        )}
      </Page.ScrollView>
    </Page>
  );
}
