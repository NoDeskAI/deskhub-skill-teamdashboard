import { useState } from "react";
import { ST } from "../../constants/status.js";
import { SIcon } from "../../components/ui/Icons.jsx";
import BrowsePage from "../../components/ui/BrowsePage.jsx";
import SkillCard from "./SkillCard.jsx";

export default function CardBrowse({ status, skills, onBack, onSelect }) {
  const [hoverSlug, setHoverSlug] = useState(null);
  const s = ST[status];
  const display = s || (status === "popular"
    ? { l: "热门技能", Icon: ST.iterating.Icon }
    : status === "active"
      ? { l: "近期活跃", Icon: ST.planned.Icon }
      : { l: "技能列表", Icon: ST.iterating.Icon });

  return (
    <BrowsePage
      backLabel="返回技能总览"
      onBack={onBack}
      icon={<SIcon s={display} size={18} />}
      title={display.l}
      count={skills.length}
      placeholder="搜索技能名称、标识符或描述..."
      items={skills}
      filterFn={(items, q) => items.filter(sk => sk.name.toLowerCase().includes(q) || sk.slug.toLowerCase().includes(q) || sk.desc.toLowerCase().includes(q))}
      renderCard={sk => (
        <SkillCard key={sk.slug} sk={sk} absolute={false}
          hovered={hoverSlug === sk.slug}
          onHover={() => setHoverSlug(sk.slug)}
          onLeave={() => setHoverSlug(null)}
          onClick={() => onSelect(sk)}
          style={{ width: 120 }}
        />
      )}
    />
  );
}
