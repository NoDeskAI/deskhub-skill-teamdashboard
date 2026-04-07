import { useState, useCallback } from "react";
import { MCPS } from "../../constants/mock-data.js";
import Stat from "../../components/ui/Stat.jsx";
import McpDetail from "./McpDetail.jsx";
import McpDeskRow from "./McpDeskRow.jsx";
import McpBrowse from "./McpBrowse.jsx";

const order = ["stable", "iterating", "planned"];

export default function SpellBook() {
  const [sel, setSel] = useState(null);
  const [showDet, setShowDet] = useState(false);
  const [browseS, setBrowseS] = useState(null);

  const openDet = useCallback(m => { setSel(m); setTimeout(() => setShowDet(true), 30); }, []);
  const closeDet = useCallback(() => { setShowDet(false); setTimeout(() => setSel(null), 350); }, []);

  const grouped = {};
  MCPS.forEach(m => { if (!grouped[m.status]) grouped[m.status] = []; grouped[m.status].push(m); });
  const cnt = {};
  order.forEach(s => cnt[s] = (grouped[s] || []).length);

  if (browseS) {
    return (<>
      <McpBrowse status={browseS} mcps={grouped[browseS] || []} onBack={() => setBrowseS(null)} onSelect={openDet} />
      <McpDetail m={sel} onClose={closeDet} show={showDet} />
    </>);
  }

  return (
    <div style={{ padding: "0 0 40px" }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "stretch" }}>
        <Stat label="MCP总数" value={MCPS.length} color="#6a8aaa" />
        <Stat label="已就绪" value={cnt.stable || 0} color="#5a4a30" />
        <Stat label="迭代中" value={cnt.iterating || 0} color="#b85c1a" />
        <Stat label="规划中" value={cnt.planned || 0} color="#3a6a3a" />
      </div>

      {order.map(status => grouped[status] && grouped[status].length > 0 && (
        <McpDeskRow key={status} status={status} mcps={grouped[status]} onSelect={openDet} onViewAll={() => setBrowseS(status)} />
      ))}

      <McpDetail m={sel} onClose={closeDet} show={showDet} />
    </div>
  );
}
