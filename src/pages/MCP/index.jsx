import { useState, useCallback } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { MCPS, INIT_MCP_REQS } from "../../constants/mock-data.js";
import { MCP_ST, MR_ST } from "../../constants/status.js";
import { PRI } from "../../constants/priority.js";
import { FONT_MONO, FONT_SANS } from "../../constants/theme.js";
import { nMrId, td } from "../../utils/helpers.js";
import Stat from "../../components/ui/Stat.jsx";
import { FormModal, FInput, FSelect, FBtn } from "../../components/ui/Form.jsx";
import McpCard from "./McpCard.jsx";
import McpDetail from "./McpDetail.jsx";
import McpDeskRow from "./McpDeskRow.jsx";
import McpBrowse from "./McpBrowse.jsx";
import McpReqPool from "./McpReqPool.jsx";
import DetailModal from "../../components/ui/DetailModal.jsx";

export default function SpellBook({ role }) {
  const [sel, setSel] = useState(null); const [showDet, setShowDet] = useState(false);
  const [browseS, setBrowseS] = useState(null);
  const [reqs, setReqs] = useState(INIT_MCP_REQS);
  const [selReq, setSelReq] = useState(null); const [showReqDet, setShowReqDet] = useState(false);
  const [fMode, setFMode] = useState(null); const [fData, setFData] = useState({});

  const openDet = useCallback(m => { setSel(m); setTimeout(() => setShowDet(true), 30); }, []);
  const closeDet = useCallback(() => { setShowDet(false); setTimeout(() => setSel(null), 350); }, []);
  const openReqDet = useCallback(r => { setSelReq(r); setTimeout(() => setShowReqDet(true), 30); }, []);
  const closeReqDet = useCallback(() => { setShowReqDet(false); setTimeout(() => setSelReq(null), 350); }, []);

  const grouped = {}; const order = ["stable", "iterating", "planned"];
  MCPS.forEach(m => { if(!grouped[m.status]) grouped[m.status]=[]; grouped[m.status].push(m); });
  const cnt = {}; order.forEach(s => cnt[s] = (grouped[s]||[]).length);

  const openCreateReq = () => { setFMode("createReq"); setFData({ name:"", priority:"medium", desc:"", submitter:"" }); };
  const openEditReq = () => { if(!selReq) return; setFMode("editReq"); setFData({ name:selReq.name, priority:selReq.priority, desc:selReq.desc, submitter:selReq.submitter }); };

  const saveReq = () => {
    if (fMode === "createReq") { setReqs(prev => [...prev, { id: nMrId(), name: fData.name||"新需求", priority: fData.priority, created: td(), desc: fData.desc||"", submitter: fData.submitter||"未知", status: "reviewing" }]); }
    else if (fMode === "editReq" && selReq) { setReqs(prev => prev.map(r => r.id===selReq.id ? {...r, name:fData.name, priority:fData.priority, desc:fData.desc, submitter:fData.submitter} : r)); setSelReq(prev => prev ? {...prev, name:fData.name, priority:fData.priority, desc:fData.desc, submitter:fData.submitter} : null); }
    setFMode(null);
  };
  const delReq = () => { if(!selReq) return; setReqs(prev => prev.filter(r => r.id!==selReq.id)); closeReqDet(); };
  const setReqStatus = (st) => { if(!selReq) return; setReqs(prev => prev.map(r => r.id===selReq.id ? {...r, status:st} : r)); setSelReq(prev => prev ? {...prev, status:st} : null); };

  if (browseS) {
    return (<>
      <McpBrowse status={browseS} mcps={grouped[browseS]||[]} onBack={()=>setBrowseS(null)} onSelect={openDet} />
      <McpDetail m={sel} onClose={closeDet} show={showDet} />
    </>);
  }

  return (
    <div style={{ padding: "0 0 40px" }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "stretch" }}>
        <Stat label="MCP总数" value={MCPS.length} color="#6a8aaa" />
        <Stat label="已就绪" value={cnt.stable||0} color="#5a4a30" />
        <Stat label="迭代中" value={cnt.iterating||0} color="#b85c1a" />
        <Stat label="需求池" value={reqs.length} color="#b8861a" />
        <div onClick={openCreateReq} style={{background:"rgba(0,0,0,0.03)",borderRadius:10,padding:"8px 14px",border:"1px dashed rgba(0,0,0,0.08)",cursor:"pointer",display:"flex",alignItems:"center",gap:4}}
          onMouseEnter={e=>e.currentTarget.style.background="rgba(0,0,0,0.06)"} onMouseLeave={e=>e.currentTarget.style.background="rgba(0,0,0,0.03)"}>
          <span style={{fontSize:14}}>+</span><span style={{fontFamily:FONT_SANS,fontSize:15,color:"#a09888"}}>提需求</span>
        </div>
      </div>

      {order.map(status => grouped[status] && grouped[status].length > 0 && (
        <McpDeskRow key={status} status={status} mcps={grouped[status]} onSelect={openDet} onViewAll={()=>setBrowseS(status)} />
      ))}

      {reqs.length > 0 && <McpReqPool reqs={reqs} setReqs={setReqs} role={role} />}

      <McpDetail m={sel} onClose={closeDet} show={showDet} />

      {/* 需求详情 */}
      {selReq && (
        <DetailModal show={showReqDet} onClose={closeReqDet} width={360}>
          <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ fontFamily: FONT_MONO, fontSize: 16, color: "#3a2a18", lineHeight: 1.5, flex: 1 }}>{selReq.name}</div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0, marginLeft: 10 }}>
                {role === "admin" && <button onClick={openEditReq} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16 }}><Pencil size={14} /></button>}
                {role === "admin" && <button onClick={delReq} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16 }}><Trash2 size={14} /></button>}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
              <span style={{ padding: "2px 7px", background: PRI[selReq.priority].bg, borderRadius: 6, fontFamily: FONT_SANS, fontSize: 14, color: PRI[selReq.priority].c }}>{PRI[selReq.priority].l}</span>
              <span style={{ padding: "2px 7px", background: "rgba(0,0,0,0.05)", borderRadius: 6, fontFamily: FONT_SANS, fontSize: 14, color: MR_ST[selReq.status].c }}>{MR_ST[selReq.status].l}</span>
              <span style={{ fontFamily: FONT_SANS, fontSize: 14, color: "#a89a78" }}>{selReq.submitter} · {selReq.created}</span>
            </div>
          </div>
          <div style={{ padding: "10px 16px", borderBottom: "1px solid rgba(0,0,0,0.06)", fontFamily: FONT_SANS, fontSize: 17, color: "#4a4540", lineHeight: 1.5 }}>{selReq.desc}</div>
          {role === "admin" && <div style={{ padding: "10px 16px" }}>
            <div style={{ fontFamily: FONT_SANS, fontSize: 14, color: "#5a5550", marginBottom: 8 }}>设置状态</div>
            <div style={{ display: "flex", gap: 6 }}>
              {[{v:"reviewing",l:"审核中"},{v:"accepted",l:"采纳"},{v:"rejected",l:"搁置"}].map(o => (
                <button key={o.v} onClick={()=>setReqStatus(o.v)} style={{ flex:1, padding: "6px", borderRadius: 6, cursor: "pointer", fontFamily: FONT_SANS, fontSize: 15, border: selReq.status===o.v ? "2px solid "+MR_ST[o.v].c : "1px solid rgba(0,0,0,0.06)", background: selReq.status===o.v ? MR_ST[o.v].c+"18" : "rgba(255,255,255,0.3)", color: MR_ST[o.v].c }}>{o.l}</button>
              ))}
            </div>
          </div>}
        </DetailModal>
      )}

      {/* 需求表单 */}
      {fMode && (
        <FormModal title={fMode==="createReq"?"提交MCP需求":"编辑需求"} show={true} onClose={()=>setFMode(null)}>
          <FInput label="需求名称" value={fData.name} onChange={e=>setFData(p=>({...p,name:e.target.value}))} placeholder="如 网页爬虫能力" />
          <FSelect label="优先级" value={fData.priority} onChange={v=>setFData(p=>({...p,priority:v}))} options={[{v:"high",l:"高",c:"#b83a2a"},{v:"medium",l:"中",c:"#b8861a"},{v:"low",l:"低",c:"#5a8a5a"}]} />
          <FInput label="提交人" value={fData.submitter} onChange={e=>setFData(p=>({...p,submitter:e.target.value}))} />
          <FInput label="需求描述" value={fData.desc} onChange={e=>setFData(p=>({...p,desc:e.target.value}))} placeholder="描述你希望的MCP能力" multiline />
          <FBtn label={fMode==="createReq"?"提交":"保存"} onClick={saveReq} full />
        </FormModal>
      )}
    </div>
  );
}
