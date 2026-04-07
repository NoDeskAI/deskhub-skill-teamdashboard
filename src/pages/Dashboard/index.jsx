import { useState, useCallback } from "react";
import { SKILLS } from "../../constants/mock-data.js";
import { ST } from "../../constants/status.js";
import Stat from "../../components/ui/Stat.jsx";
import DeskRow from "./DeskRow.jsx";
import CardBrowse from "./CardBrowse.jsx";
import SkillDetail from "./SkillDetail.jsx";

const order = ["iterating", "testing", "planned", "stable"];

export default function Dashboard() {
  const [selSk, setSelSk] = useState(null);
  const [showDet, setShowDet] = useState(false);
  const [browseStatus, setBrowseStatus] = useState(null);

  const handleSel = useCallback(sk => { setSelSk(sk); setTimeout(() => setShowDet(true), 30); }, []);
  const handleCloseDet = useCallback(() => { setShowDet(false); setTimeout(() => setSelSk(null), 350); }, []);

  const grouped = {};
  SKILLS.forEach(sk => { if (!grouped[sk.status]) grouped[sk.status] = []; grouped[sk.status].push(sk); });
  const cnt = {}; order.forEach(s => cnt[s] = (grouped[s] || []).length);

  if (browseStatus) {
    return (
      <div style={{ paddingTop: 16 }}>
        <CardBrowse
          status={browseStatus}
          skills={grouped[browseStatus] || []}
          onBack={() => setBrowseStatus(null)}
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
        <Stat label="迭代中" value={cnt.iterating} color="#b85c1a" />
        <Stat label="测试中" value={cnt.testing} color="#8a3a3a" />
        <Stat label="已完成" value={cnt.stable} color="#4a7a4a" />
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <Stat label="总下载" value={SKILLS.reduce((a, b) => a + b.dl, 0)} color="#6a5a42" />
        <Stat label="总查看" value={SKILLS.reduce((a, b) => a + b.views, 0)} color="#6a5a42" />
        <Stat label="PV (本周)" value="12.4k" color="#5a7a5a" />
        <Stat label="UV (本周)" value="3.2k" color="#5a7a5a" />
      </div>
      {order.map(status => grouped[status] && grouped[status].length > 0 && (
        <DeskRow key={status} status={status} skills={grouped[status]} onSelect={handleSel} onViewAll={s => setBrowseStatus(s)} />
      ))}
      <SkillDetail sk={selSk} onClose={handleCloseDet} show={showDet} />
    </>
  );
}
