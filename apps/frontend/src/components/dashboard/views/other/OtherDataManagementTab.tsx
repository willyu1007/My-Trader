import type { OtherViewProps } from "../OtherView";
import { OtherDataManagementIngestSection } from "./data-management/OtherDataManagementIngestSection";
import { OtherDataManagementRegistrySection } from "./data-management/OtherDataManagementRegistrySection";
import { OtherDataManagementSchedulerSection } from "./data-management/OtherDataManagementSchedulerSection";
import { OtherDataManagementSourceSection } from "./data-management/OtherDataManagementSourceSection";
import { OtherDataManagementTargetPoolSection } from "./data-management/OtherDataManagementTargetPoolSection";

export function OtherDataManagementTab(props: OtherViewProps) {
  return (
    <>
      <OtherDataManagementSourceSection {...props} />
      <OtherDataManagementSchedulerSection {...props} />
      <OtherDataManagementTargetPoolSection {...props} />
      <OtherDataManagementRegistrySection {...props} />
      <OtherDataManagementIngestSection {...props} />
    </>
  );
}
