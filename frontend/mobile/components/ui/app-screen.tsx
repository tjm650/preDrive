import type { ReactNode } from "react";
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { colors } from "@predrive/shared/tokens";
interface Props { children: ReactNode; scroll?: boolean; contentStyle?: StyleProp<ViewStyle>; }
export function AppScreen({children,scroll=true,contentStyle}:Props) {
  if (!scroll) return <View style={[styles.screen,styles.content,contentStyle]}>{children}</View>;
  return <ScrollView style={styles.screen} contentContainerStyle={[styles.content,contentStyle]} keyboardShouldPersistTaps="handled">{children}</ScrollView>;
}
const styles=StyleSheet.create({screen:{flex:1,backgroundColor:colors.canvas},content:{flexGrow:1,paddingHorizontal:20,paddingVertical:24,gap:16}});
