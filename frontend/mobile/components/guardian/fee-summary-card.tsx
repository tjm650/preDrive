import {StyleSheet,Text,View} from "react-native";
import type {Invoice} from "@predrive/shared/types";
import {colors} from "@predrive/shared/tokens";
import {AppCard} from "../ui/app-card";
function formatMoney(amount:number,currency:"USD"|"ZiG"){return new Intl.NumberFormat("en-US",{style:"currency",currency:currency==="USD"?"USD":"ZIG",minimumFractionDigits:2}).format(amount).replace("ZIG","ZiG");}
export function FeeSummaryCard({invoice,zigEquivalent}:{invoice:Invoice|null;zigEquivalent?:number}){
 if(!invoice)return <AppCard style={s.card}><Text style={s.title}>No invoices available</Text><Text style={s.body}>Your school's fee statements will appear here when issued.</Text></AppCard>;
 return <AppCard style={s.card}><View style={s.row}><Text style={s.label}>Invoice {invoice.invoiceNumber}</Text><Text style={s.status}>{invoice.status.replace("_"," ")}</Text></View><Text style={s.balance}>{formatMoney(invoice.balance.amount,invoice.balance.currency)}</Text>{zigEquivalent!==undefined?<Text style={s.equivalent}>ZiG {zigEquivalent.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})} · indicative rate</Text>:null}<Text style={s.due}>Due {invoice.dueDate}</Text></AppCard>;
}
const s=StyleSheet.create({card:{padding:18,gap:8},row:{flexDirection:"row",alignItems:"center",justifyContent:"space-between"},label:{fontSize:14,fontWeight:"700",color:colors.ink},status:{fontSize:12,fontWeight:"700",color:colors.warning,textTransform:"capitalize"},balance:{fontSize:28,fontWeight:"800",color:colors.ink},equivalent:{fontSize:14,color:colors.ink,opacity:.7},due:{fontSize:14,color:colors.ink,opacity:.7}});
