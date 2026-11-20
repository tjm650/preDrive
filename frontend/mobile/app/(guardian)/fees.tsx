import { AppScreen } from "../../components/ui";
import { GuardianInvoiceList } from "../../components/guardian";

export default function GuardianFees() {
  return (
    <AppScreen>
      <GuardianInvoiceList invoices={[]} indicativeZigPerUsd={0} />
    </AppScreen>
  );
}
