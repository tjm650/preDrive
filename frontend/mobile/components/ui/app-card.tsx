import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, radii } from "@predrive/shared/tokens";
export function AppCard({children,style}:{children:ReactNode;style?:StyleProp<ViewStyle>}) {
  return <View style={[styles.card,style]}>{children}</View>;
}
const styles=StyleSheet.create({card:{backgroundColor:colors.surface,borderColor:colors.line,borderWidth:1,borderRadius:radii.card}});
