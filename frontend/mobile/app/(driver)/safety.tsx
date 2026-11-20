import { AppScreen, ScreenHeading } from "../../components/ui";
import { DelayReportForm, DriverSosPanel } from "../../components/driver";
export default function DriverSafety() {
  return <AppScreen><ScreenHeading title="Safety" subtitle="Report a delay or request urgent assistance."/><DelayReportForm/><DriverSosPanel/></AppScreen>;
}
