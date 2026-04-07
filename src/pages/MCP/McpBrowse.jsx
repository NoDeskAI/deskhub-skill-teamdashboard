import { useState } from "react";
import { MCP_ST } from "../../constants/status.js";
import { SIcon } from "../../components/ui/Icons.jsx";
import BrowsePage from "../../components/ui/BrowsePage.jsx";
import McpCard from "./McpCard.jsx";

export default function McpBrowse({ status, mcps, onBack, onSelect }) {
  const [hId, setHId] = useState(null);
  const s = MCP_ST[status];

  return (
    <BrowsePage
      backLabel="返回MCP能力"
      onBack={onBack}
      icon={<SIcon s={s} size={18} />}
      title={s.l}
      count={mcps.length}
      placeholder="搜索MCP名称、标识符或描述..."
      items={mcps}
      filterFn={(items, q) => items.filter(m => m.name.toLowerCase().includes(q) || m.slug.toLowerCase().includes(q) || m.desc.toLowerCase().includes(q) || m.maintainer.toLowerCase().includes(q))}
      renderCard={m => (
        <McpCard key={m.id} m={m} absolute={false}
          hovered={hId === m.id}
          onHover={() => setHId(m.id)}
          onLeave={() => setHId(null)}
          onClick={() => onSelect(m)}
          style={{ width: 125 }}
        />
      )}
    />
  );
}
