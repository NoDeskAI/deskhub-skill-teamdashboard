import { useState, useCallback } from "react";
import { SKILLS } from "../../constants/mock-data.js";
import Stat from "../../components/ui/Stat.jsx";
import DeskRow from "./DeskRow.jsx";
import CardBrowse from "./CardBrowse.jsx";
import SkillDetail from "./SkillDetail.jsx";

export default function Dashboard() {
  const [selSk, setSelSk] = useState(null);
  const [showDet, setShowDet] = useState(false);
  const [browseGroup, setBrowseGroup] = useState(null);

  const handleSel = useCallback(sk => { setSelSk(sk); setTimeout(() => setShowDet(true), 30); }, []);
  const handleCloseDet = useCallback(() => { setShowDet(false); setTimeout(() => setSelSk(null), 350); }, []);

  // 两组：进行中 = iterating + testing + planned，已完成 = stable
  const active = SKILLS.filter(sk => sk.status !== "stable");
  const done = SKILLS.filter(sk => sk.status === "stable");

  if (browseGroup) {
    const skills = browseGroup === "active" ? active : done;
    return (
      <div style={{ paddingTop: 16 }}>
        <CardBrowse
          status={browseGroup}
          skills={skills}
          onBack={() => setBrowseGroup(null)}
          onSelect={handleSel}
        />
        <SkillDetail sk={selSk} onClose={handleCloseDet} show={showDet} />
      </div>
    );
  }

  return (
    <>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <Stat label="技能总数" value={SKILLS.length} color="#6a5a42" />
        <Stat label="进行中" value={active.length} color="#b85c1a" />
        <Stat label="已完成" value={done.length} color="#4a7a4a" />
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <Stat label="总下载" value={SKILLS.reduce((a, b) => a + b.dl, 0)} color="#6a5a42" />
        <Stat label="总查看" value={SKILLS.reduce((a, b) => a + b.views, 0)} color="#6a5a42" />
        <Stat label="PV (本周)" value="12.4k" color="#5a7a5a" />
        <Stat label="UV (本周)" value="3.2k" color="#5a7a5a" />
      </div>
      {active.length > 0 && (
        <DeskRow label="进行中" labelColor="#b85c1a" skills={active} onSelect={handleSel} onViewAll={() => setBrowseGroup("active")} />
      )}
      {done.length > 0 && (
        <DeskRow label="已完成" labelColor="#5a4a30" skills={done} onSelect={handleSel} onViewAll={() => setBrowseGroup("done")} />
      )}
      <SkillDetail sk={selSk} onClose={handleCloseDet} show={showDet} />
    </>
  );
}
