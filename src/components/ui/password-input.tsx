import { ViewIcon, ViewOffIcon } from "@hugeicons/core-free-icons";
import { InputGroup, PressableFeedback } from "heroui-native";
import { useState } from "react";

import { HugeIcons } from "@/components/ui/huge-icons";

type PasswordInputProps = React.ComponentProps<typeof InputGroup.Input>;

export function PasswordInput(props: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <InputGroup>
      <InputGroup.Input {...props} secureTextEntry={!visible} />
      <InputGroup.Suffix>
        <PressableFeedback
          className="centered size-6"
          onPress={() => setVisible((prev) => !prev)}
        >
          <HugeIcons
            className="size-4 text-muted"
            icon={visible ? ViewOffIcon : ViewIcon}
          />
        </PressableFeedback>
      </InputGroup.Suffix>
    </InputGroup>
  );
}
