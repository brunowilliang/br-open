import { Alert, Button } from "heroui-native";

type WidgetAlertAction = {
  isDisabled?: boolean;
  label: string;
  onPress: () => void;
};

type WidgetAlertProps = {
  action?: WidgetAlertAction;
  description?: string;
  status?: "accent" | "danger" | "default" | "success" | "warning";
  title: string;
};

export function WidgetAlert(props: WidgetAlertProps) {
  return (
    <Alert status={props.status}>
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>{props.title}</Alert.Title>
        {props.description ? (
          <Alert.Description>{props.description}</Alert.Description>
        ) : null}
      </Alert.Content>
      {props.action ? (
        <Button
          isDisabled={props.action.isDisabled}
          onPress={props.action.onPress}
          size="sm"
          variant="primary"
        >
          <Button.Label>{props.action.label}</Button.Label>
        </Button>
      ) : null}
    </Alert>
  );
}
