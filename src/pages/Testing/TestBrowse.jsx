import { useState } from "react";
import { DIcon } from "../../components/ui/Icons.jsx";
import BrowsePage from "../../components/ui/BrowsePage.jsx";
import TestCard from "./TestCard.jsx";

export default function TestBrowse({ label, icon, variants, onBack, onSelect, dims }) {
  const [hId, setHId] = useState(null);

  return (
    <BrowsePage
      backLabel="返回方案评测"
      onBack={onBack}
      icon={<DIcon name={icon} size={18} />}
      title={label}
      count={variants.length}
      placeholder="搜索方案名称、工单或上传人..."
      items={variants}
      filterFn={(items, q) => items.filter(v => v.name.toLowerCase().includes(q) || v.planName.toLowerCase().includes(q) || v.uploader.toLowerCase().includes(q))}
      renderCard={v => (
        <TestCard key={v.planId + "-" + v.id} v={v} dims={dims} absolute={false}
          hovered={hId === v.planId + v.id}
          onHover={() => setHId(v.planId + v.id)}
          onLeave={() => setHId(null)}
          onClick={() => onSelect(v)}
          style={{ width: 126 }}
        />
      )}
    />
  );
}
