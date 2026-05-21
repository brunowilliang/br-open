import {
  Description,
  ListGroup,
  PressableFeedback,
  SearchField,
  Separator,
} from "heroui-native";
import { FlatList, View } from "react-native";

import { Image } from "@/components/core/image";

type PlayerItem = {
  id: string;
  name: string;
  nickname: string;
};

const initialPlayers: PlayerItem[] = [
  { id: "1", name: "Bruno Willian Garcia", nickname: "Bruninho" },
  { id: "2", name: "Matheus Oliveira", nickname: "Teteu" },
  { id: "3", name: "Joao Pedro Costa", nickname: "JP" },
  { id: "4", name: "Lucas Almeida", nickname: "Luquinhas" },
  { id: "5", name: "Pedro Henrique", nickname: "Pedrinho" },
  { id: "6", name: "Caio Martins", nickname: "Caio" },
  { id: "7", name: "Guilherme Costa", nickname: "Gui" },
  { id: "8", name: "Rafael Souza", nickname: "Rafa" },
  { id: "9", name: "Rafael Souza", nickname: "Rafa" },
  { id: "10", name: "Rafael Souza", nickname: "Rafa" },
  { id: "11", name: "Rafael Souza", nickname: "Rafa" },
  { id: "12", name: "Rafael Souza", nickname: "Rafa" },
];

export const Players = () => (
  <View className="flex-1 gap-4 pb-safe-offset-4">
    <SearchField>
      <SearchField.Group>
        <SearchField.SearchIcon />
        <SearchField.Input placeholder="Pesquisar jogadores" />
        <SearchField.ClearButton />
      </SearchField.Group>
      <Description>Busque jogadores pelo nome ou apelido.</Description>
    </SearchField>

    <ListGroup className="flex-1">
      <FlatList
        data={initialPlayers}
        ItemSeparatorComponent={() => <Separator className="mx-5" />}
        keyboardShouldPersistTaps="handled"
        keyExtractor={(item) => item.id}
        renderItem={({ item }: { item: PlayerItem }) => (
          <PressableFeedback animation={false}>
            <ListGroup.Item disabled>
              <ListGroup.ItemPrefix>
                <Image
                  alt={item.name}
                  className="size-10 rounded-full"
                  fallback="green"
                  source="https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/green.jpg"
                />
              </ListGroup.ItemPrefix>
              <ListGroup.ItemContent>
                <ListGroup.ItemTitle>{item.name}</ListGroup.ItemTitle>
                <ListGroup.ItemDescription>
                  {item.nickname}
                </ListGroup.ItemDescription>
              </ListGroup.ItemContent>
              <ListGroup.ItemSuffix />
            </ListGroup.Item>
            <PressableFeedback.Highlight />
          </PressableFeedback>
        )}
        showsVerticalScrollIndicator={false}
      />
    </ListGroup>
  </View>
);
