import { DescriptionItem } from "../components/DescriptionItem";
import { Panel } from "../primitives/Panel";

export interface AccountViewProps {
  account: {
    label: string;
    id: string;
    dataDir: string;
    createdAt: number | null;
    lastLoginAt: number | null;
  };
  formatDateTime: (value: number | null) => string;
}

export function AccountView({ account, formatDateTime }: AccountViewProps) {
  return (
    <Panel>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 max-w-4xl">
        <DescriptionItem label="当前账号" value={account.label} />
        <DescriptionItem
          label="账号 ID"
          value={<span className="font-mono text-xs">{account.id}</span>}
        />
        <DescriptionItem
          label="数据目录"
          value={<span className="font-mono text-xs">{account.dataDir}</span>}
        />
        <DescriptionItem label="创建时间" value={formatDateTime(account.createdAt)} />
        <DescriptionItem label="最近登录" value={formatDateTime(account.lastLoginAt)} />
      </div>
    </Panel>
  );
}
