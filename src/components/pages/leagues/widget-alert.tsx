import { Alert } from "heroui-native";

type WidgetAlertProps = {
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
    </Alert>
  );
}
