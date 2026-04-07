import { useState } from "react";
import BrowsePage from "../../components/ui/BrowsePage.jsx";
import WoCard from "./WoCard.jsx";

/**
 * 工单全量浏览页 — 搜索过滤 name/desc/type
 */
export default function WoBrowse({ label, icon, wos, onBack, onSelect }) {
  const [hoverId, setHoverId] = useState(null);

  return (
    <BrowsePage
      backLabel="返回工单管理"
      onBack={onBack}
      icon={icon}
      title={label || "工单浏览"}
      count={wos.length}
      placeholder="搜索工单名称、描述或类型..."
      items={wos}
      filterFn={(items, q) => items.filter(wo => {
        const s = q.toLowerCase();
        return (wo.name || "").toLowerCase().includes(s)
          || (wo.desc || "").toLowerCase().includes(s)
          || (wo.type || "").toLowerCase().includes(s);
      })}
      renderCard={wo => (
        <WoCard
          key={wo.id}
          wo={wo}
          absolute={false}
          hovered={hoverId === wo.id}
          onHover={() => setHoverId(wo.id)}
          onLeave={() => setHoverId(null)}
          onClick={() => onSelect && onSelect(wo)}
        />
      )}
    />
  );
}
