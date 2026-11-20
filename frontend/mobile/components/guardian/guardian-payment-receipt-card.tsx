import { StyleSheet, Text, View } from "react-native";
import type { Payment, PaymentReceipt } from "@predrive/shared/types";
import { colors } from "@predrive/shared/tokens";
import { AppCard } from "../ui/app-card";

interface Props { payment: Payment; receipt: PaymentReceipt | null; }
function formatAmount(payment: Payment) {
  const amount = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(payment.amount.amount);
  return payment.amount.currency === "USD" ? `US$${amount}` : `ZiG ${amount}`;
}
export function GuardianPaymentReceiptCard({ payment, receipt }: Props) {
  const confirmed = payment.status === "succeeded" && receipt !== null;
  return (
    <AppCard style={styles.card}>
      <View style={styles.headingRow}>
        <Text style={styles.title}>{confirmed ? "Payment receipt" : "Payment status"}</Text>
        <Text style={[styles.status, { color: confirmed ? colors.success : payment.status === "failed" ? colors.danger : colors.warning }]}>{payment.status.replace("_", " ")}</Text>
      </View>
      <Text style={styles.amount}>{formatAmount(payment)}</Text>
      <View style={styles.row}><Text style={styles.label}>Payment method</Text><Text style={styles.value}>{payment.method === "ecocash" ? "EcoCash" : payment.method === "cbz_transfer" ? "CBZ" : payment.method === "cabs_transfer" ? "CABS" : "Card"}</Text></View>
      {payment.reference ? <View style={styles.row}><Text style={styles.label}>Reference</Text><Text style={styles.value}>{payment.reference}</Text></View> : null}
      {confirmed ? (
        <>
          <View style={styles.row}><Text style={styles.label}>Receipt number</Text><Text style={styles.value}>{receipt.receiptNumber}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Issued</Text><Text style={styles.value}>{receipt.issuedAt}</Text></View>
        </>
      ) : <Text style={styles.note}>A receipt is available only after the payment service confirms settlement.</Text>}
    </AppCard>
  );
}
const styles = StyleSheet.create({
  card: { padding: 16, gap: 12 },
  headingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  title: { color: colors.ink, fontSize: 17, fontWeight: "800" },
  status: { fontSize: 13, fontWeight: "800", textTransform: "capitalize" },
  amount: { color: colors.ink, fontSize: 25, fontWeight: "800", fontVariant: ["tabular-nums"] },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 9 },
  label: { color: colors.ink, opacity: 0.7, fontSize: 14 },
  value: { color: colors.ink, fontSize: 14, fontWeight: "700", textAlign: "right", flexShrink: 1 },
  note: { color: colors.warning, fontSize: 14, lineHeight: 20 },
});
