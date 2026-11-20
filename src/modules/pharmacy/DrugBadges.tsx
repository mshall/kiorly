import { Row } from "@/components/ui";
import { Badge } from "@/components/ui";
import { usePh } from "./hooks";

export function DrugBadges({ rxOnly, controlled, coldChain }: { rxOnly?: boolean; controlled?: boolean; coldChain?: boolean }) {
  const { t } = usePh();
  return (
    <Row gap={6} style={{ flexWrap: "wrap" }}>
      {rxOnly ? <Badge tone="ink" label={t("pharmacy.rxOnly")} /> : null}
      {controlled ? <Badge tone="danger" label={t("pharmacy.controlledBadge")} icon="shield" /> : null}
      {coldChain ? <Badge tone="ocean" label={t("pharmacy.coldChain")} icon="thermometer" /> : null}
    </Row>
  );
}
