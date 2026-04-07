import BrowsePage from "../../components/ui/BrowsePage.jsx";
import WoCard from "./WoCard.jsx";

/**
 * 工单全量浏览页 — 搜索过滤 name/desc/type
 */
export default function WoBrowse({ label, icon, wos, onBack, onSelect }) {
  return (
    <BrowsePage
      label={label}
      icon={icon}
      items={wos}
      getKey={wo => wo.id}
      filter={(wo, q) => {
        const s = q.toLowerCase();
        return (wo.name || "").toLowerCase().includes(s)
          || (wo.desc || "").toLowerCase().includes(s)
          || (wo.type || "").toLowerCase().includes(s);
      }}
      renderCard={(wo, { hovered, onHover, onLeave, onClick }) => (
        <WoCard
          wo={wo}
          absolute={false}
          hovered={hovered}
          onHover={onHover}
          onLeave={onLeave}
          onClick={onClick}
        />
      )}
      onBack={onBack}
      onSelect={onSelect}
    />
  );
}
