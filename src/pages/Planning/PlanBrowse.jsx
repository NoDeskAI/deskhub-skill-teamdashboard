import { useState } from "react";
import { DIcon } from "../../components/ui/Icons.jsx";
import BrowsePage from "../../components/ui/BrowsePage.jsx";
import PlanCard from "./PlanCard.jsx";

export default function PlanBrowse({ label, icon, plans, onBack, onSelect }) {
  const [hId, setHId] = useState(null);

  return (
    <BrowsePage
      backLabel="返回需求规划"
      onBack={onBack}
      icon={<DIcon name={icon} size={18} />}
      title={label}
      count={plans.length}
      placeholder="搜索工单名称或描述..."
      items={plans}
      filterFn={(items, q) => items.filter(p => p.name.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q))}
      gridMin={148}
      renderCard={p => (
        <PlanCard key={p.id} plan={p} absolute={false}
          hovered={hId === p.id}
          onHover={() => setHId(p.id)}
          onLeave={() => setHId(null)}
          onClick={() => onSelect(p)}
          style={{ width: 140 }}
        />
      )}
    />
  );
}
