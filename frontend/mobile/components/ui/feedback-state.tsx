import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { colors } from "@predrive/shared/tokens";
export function FeedbackState({title,description,loading=false}:{title:string;description?:string;loading?:boolean}) {
 return <View accessibilityRole="summary" style={styles.container}>{loading?<ActivityIndicator color={colors.ink}/>:null}<Text style={styles.title}>{title}</Text>{description?<Text style={styles.description}>{description}</Text>:null}</View>;
}
const styles=StyleSheet.create({container:{minHeight:160,alignItems:"center",justifyContent:"center",gap:10,padding:24},title:{color:colors.ink,fontSize:18,fontWeight:"700",textAlign:"center"},description:{color:colors.ink,opacity:0.75,fontSize:16,lineHeight:22,textAlign:"center"}});
