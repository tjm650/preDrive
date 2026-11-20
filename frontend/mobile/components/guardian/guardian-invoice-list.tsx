import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { Invoice, PaymentMethod } from "@predrive/shared/types";
import { colors } from "@predrive/shared/tokens";
import { ActionButton } from "../ui/action-button";
import { AppCard } from "../ui/app-card";
import { GuardianPaymentMethodSelector } from "./guardian-payment-method-selector";

type LocalPaymentMethod = Exclude<PaymentMethod, "card">;
interface Props {
  invoices: Invoice[];
  indicativeZigPerUsd: number;
  onPayInvoice?: (invoice: Invoice, method: LocalPaymentMethod) => void;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}
function money(value: number, currency: "USD" | "ZiG") {
  const formatted = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  return currency === "USD" ? `US$${formatted}` : `ZiG ${formatted}`;
}
function dualCurrency(value: { amount: number; currency: "USD" | "ZiG" }, rate: number) {
  const usd = value.currency === "USD" ? value.amount : value.amount / rate;
  const zig = value.currency === "ZiG" ? value.amount : value.amount * rate;
  return { primary: money(usd, "USD"), secondary: money(zig, "ZiG") };
}
function statusColor(status: Invoice["status"]) {
  if (status === "paid") return colors.success;
  if (status === "overdue") return colors.danger;
  if (status === "void" || status === "draft") return colors.ink;
  return colors.warning;
}
export function GuardianInvoiceList({ invoices, indicativeZigPerUsd, onPayInvoice, loading = false, error, onRetry }: Props) {
  const [method, setMethod] = useState<LocalPaymentMethod>("ecocash");
  const validRate = Number.isFinite(indicativeZigPerUsd) && indicativeZigPerUsd > 0;
  if (loading) return <AppCard style={styles.state}><Text style={styles.heading}>Loading fee records</Text><Text style={styles.body}>Your latest invoices are being retrieved.</Text></AppCard>;
  if (error) return <AppCard style={styles.state}><Text style={styles.heading}>Fee records unavailable</Text><Text style={styles.body}>{error}</Text>{onRetry ? <Text accessibilityRole="button" onPress={onRetry} style={styles.retry}>Try again</Text> : null}</AppCard>;
  if (!validRate) return <AppCard style={styles.state}><Text style={styles.heading}>Exchange rate unavailable</Text><Text style={styles.body}>The school’s current indicative ZiG rate is not available. Contact the school before relying on converted totals.</Text></AppCard>;
  if (invoices.length === 0) return <AppCard style={styles.state}><Text style={styles.heading}>No invoices available</Text><Text style={styles.body}>Issued fee statements will appear here when your school publishes them.</Text></AppCard>;
  return (
    <View style={styles.list}>
      {invoices.map((invoice) => {
        const balance = dualCurrency(invoice.balance, indicativeZigPerUsd);
        const total = dualCurrency(invoice.total, indicativeZigPerUsd);
        const canPay = Boolean(onPayInvoice) && invoice.balance.amount > 0 && !["draft", "paid", "void"].includes(invoice.status);
        return (
          <AppCard key={invoice.id} style={styles.invoice}>
            <View style={styles.topline}>
              <View style={styles.invoiceIdentity}>
                <Text style={styles.invoiceNumber}>Invoice {invoice.invoiceNumber}</Text>
                <Text style={[styles.status, { color: statusColor(invoice.status) }]}>{invoice.status.replace("_", " ")}</Text>
              </View>
              <Text style={styles.due}>Due {invoice.dueDate}</Text>
            </View>
            <View style={styles.amountBlock}>
              <Text style={styles.caption}>Outstanding balance</Text>
              <Text style={styles.amount}>{balance.primary}</Text>
              <Text style={styles.equivalent}>{balance.secondary} · indicative rate</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.row}><Text style={styles.caption}>Invoice total</Text><Text style={styles.value}>{total.primary}</Text></View>
            <Text style={styles.sectionTitle}>Fee breakdown</Text>
            {invoice.items.map((item) => {
              const line = dualCurrency(item.amount, indicativeZigPerUsd);
              return <View key={item.id} style={styles.lineItem}><Text style={styles.lineLabel}>{item.description}</Text><View style={styles.lineAmounts}><Text style={styles.value}>{line.primary}</Text><Text style={styles.smallEquivalent}>{line.secondary}</Text></View></View>;
            })}
            {invoice.balance.amount > 0 && !["draft", "void"].includes(invoice.status) ? (
              <View style={styles.paymentBlock}>
                <Text style={styles.sectionTitle}>Payment method</Text>
                <GuardianPaymentMethodSelector value={method} onChange={setMethod} disabled={!onPayInvoice} />
                {onPayInvoice ? (
                  <ActionButton label={`Continue with ${method === "ecocash" ? "EcoCash" : method === "cbz_transfer" ? "CBZ" : "CABS"}`} onPress={() => onPayInvoice(invoice, method)} />
                ) : (
                  <Text style={styles.notice}>Online payment is not connected. No payment has been initiated.</Text>
                )}
              </View>
            ) : null}
          </AppCard>
        );
      })}
      <Text style={styles.rateNote}>ZiG conversions use the school’s configured indicative rate. Confirm the applicable rate with the school before payment.</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  list: { gap: 14 },
  state: { padding: 18, minHeight: 130, justifyContent: "center", gap: 8 },
  heading: { color: colors.ink, fontSize: 18, fontWeight: "800" },
  body: { color: colors.ink, opacity: 0.72, fontSize: 15, lineHeight: 21 },
  retry: { color: colors.info, fontSize: 15, fontWeight: "800", paddingVertical: 10 },
  invoice: { padding: 16, gap: 13 },
  topline: { gap: 5 },
  invoiceIdentity: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  invoiceNumber: { color: colors.ink, fontSize: 16, fontWeight: "800" },
  status: { fontSize: 13, fontWeight: "800", textTransform: "capitalize" },
  due: { color: colors.ink, opacity: 0.68, fontSize: 14 },
  amountBlock: { backgroundColor: colors.canvas, padding: 14, borderRadius: 10, gap: 4 },
  caption: { color: colors.ink, opacity: 0.7, fontSize: 14 },
  amount: { color: colors.ink, fontSize: 28, fontWeight: "800", fontVariant: ["tabular-nums"] },
  equivalent: { color: colors.ink, opacity: 0.7, fontSize: 14 },
  divider: { height: 1, backgroundColor: colors.line },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  value: { color: colors.ink, fontSize: 14, fontWeight: "700", fontVariant: ["tabular-nums"] },
  sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: "800" },
  lineItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  lineLabel: { flex: 1, color: colors.ink, fontSize: 15 },
  lineAmounts: { alignItems: "flex-end", gap: 2 },
  smallEquivalent: { color: colors.ink, opacity: 0.65, fontSize: 12 },
  paymentBlock: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 14, gap: 10 },
  notice: { color: colors.warning, fontSize: 14, lineHeight: 20 },
  rateNote: { color: colors.ink, opacity: 0.68, fontSize: 13, lineHeight: 18, paddingHorizontal: 2 },
});
