import { useState, useCallback } from "react";
import { Settings2, CheckCircle2, X, Eye } from "lucide-react";
import { INIT_DIMS } from "../../constants/mock-data.js";
import { nDid, td } from "../../utils/helpers.js";
import Stat from "../../components/ui/Stat.jsx";
import StarRate from "../../components/ui/StarRate.jsx";
import { FormModal, FInput, FBtn } from "../../components/ui/Form.jsx";
import TestCard from "./TestCard.jsx";
import TestDeskRow from "./TestDeskRow.jsx";
import TestBrowse from "./TestBrowse.jsx";
import { FONT_MONO, FONT_SANS } from "../../constants/theme.js";

export default function TestingRoom({ plans, setPlans, role }) {
  const [dims, setDims] = useState(INIT_DIMS);
  const [selVar, setSelVar] = useState(null); const [selPlanId, setSelPlanId] = useState(null);
  const [showScore, setShowScore] = useState(false);
  const [scores, setScores] = useState({}); const [passed, setPassed] = useState(null);
  const [comment, setComment] = useState(""); const [reportLink, setReportLink] = useState(""); const [tester, setTester] = useState("");
  const [showDimMgr, setShowDimMgr] = useState(false); const [newDim, setNewDim] = useState("");
  const [browseType, setBrowseType] = useState(null);

  const allVars = []; plans.forEach(p => p.variants.forEach(v => allVars.push({ ...v, planId: p.id, planName: p.name })));
  const pending = allVars.filter(v => !v.tested);
  const done = allVars.filter(v => v.tested);

  const openScore = (v) => {
    setSelVar(v); setSelPlanId(v.planId);
    setScores(v.scores || {}); setPassed(v.passed !== null && v.passed !== undefined ? v.passed : null);
    setComment(v.comment || ""); setReportLink(v.reportLink || ""); setTester(v.tester || "");
    setTimeout(() => setShowScore(true), 30);
  };
  const closeScore = () => { setShowScore(false); setTimeout(() => { setSelVar(null); setSelPlanId(null); }, 350); };

  const submitScore = () => {
    if (passed === null || !tester) return;
    setPlans(prev => prev.map(p => p.id === selPlanId ? { ...p, variants: p.variants.map(v => v.id === selVar.id ? { ...v, tested: true, passed, scores, comment, reportLink, tester, testedAt: td() } : v) } : p));
    closeScore();
  };

  const addDim = () => { if (!newDim.trim()) return; setDims(prev => [...prev, { id: nDid(), name: newDim.trim(), max: 5, active: true }]); setNewDim(""); };
  const delDim = id => setDims(prev => prev.filter(d => d.id !== id));
  const toggleDim = id => setDims(prev => prev.map(d => d.id === id ? { ...d, active: !d.active } : d));
  const editDim = (id, field, val) => setDims(prev => prev.map(d => d.id === id ? { ...d, [field]: val } : d));
  const activeDims = dims.filter(d => d.active);

  const browseSelect = useCallback(v => openScore(v), []);

  if (browseType) {
    const bv = browseType === "pending" ? pending : done;
    return (<>
      <TestBrowse label={browseType==="pending"?"\u5f85\u8bc4\u6d4b":"\u5df2\u8bc4\u6d4b"} icon={browseType==="pending"?"flask":"clipboard"} variants={bv} dims={dims} onBack={()=>setBrowseType(null)} onSelect={browseSelect} />
      {selVar && (<div onClick={closeScore} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.4)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", opacity: showScore ? 1 : 0, pointerEvents: showScore ? "auto" : "none", transition: "opacity 0.3s" }}>
        <div onClick={e => e.stopPropagation()} style={{ width: 400, maxHeight: "85vh", background: "#fff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 14, boxShadow: "0 12px 40px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.06)", overflow: "auto", transform: showScore ? "scale(1) translateY(0)" : "scale(0.85) translateY(30px)", transition: "transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)" }}>
          <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: 16, color: "#3a2a18", lineHeight: 1.5 }}>{selVar.name}</div>
            <div style={{ fontFamily: FONT_SANS, fontSize: 15, color: "#9a8a68", marginTop: 4 }}>{"\u6240\u5c5e"}: {selVar.planName} · {selVar.uploader}</div>
          </div>
          {selVar.desc && <div style={{ padding: "8px 16px", borderBottom: "1px solid rgba(0,0,0,0.05)", fontFamily: FONT_SANS, fontSize: 15, color: "#4a4540" }}>{selVar.desc}</div>}
          {role !== "member" ? (<>
          <div style={{ padding: "12px 16px" }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: "#5a5550", marginBottom: 10 }}>{"\u9010\u9879\u8bc4\u5206"}</div>
            {activeDims.map(d => (<div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}><span style={{ fontFamily: FONT_SANS, fontSize: 16, color: "#4a4540" }}>{d.name}</span><StarRate value={scores[d.id] || 0} max={d.max} onChange={val => setScores(prev => ({ ...prev, [d.id]: val }))} /></div>))}
          </div>
          <div style={{ padding: "0 16px 12px" }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: "#5a5550", marginBottom: 8 }}>{"\u8bc4\u6d4b\u7ed3\u679c"}</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <button onClick={() => setPassed(true)} style={{ flex: 1, padding: "8px", borderRadius: 8, cursor: "pointer", fontFamily: FONT_SANS, fontSize: 17, border: passed === true ? "2px solid #4a8a4a" : "1px solid rgba(0,0,0,0.06)", background: passed === true ? "rgba(74,138,74,0.15)" : "rgba(255,255,255,0.3)", color: "#4a8a4a" }}><CheckCircle2 size={14} style={{verticalAlign:"middle",marginRight:4}} />{"\u901a\u8fc7"}</button>
              <button onClick={() => setPassed(false)} style={{ flex: 1, padding: "8px", borderRadius: 8, cursor: "pointer", fontFamily: FONT_SANS, fontSize: 17, border: passed === false ? "2px solid #b83a2a" : "1px solid rgba(0,0,0,0.06)", background: passed === false ? "rgba(184,58,42,0.15)" : "rgba(255,255,255,0.3)", color: "#b83a2a" }}><X size={14} style={{verticalAlign:"middle",marginRight:4}} />{"\u672a\u901a\u8fc7"}</button>
            </div>
            <FInput label={"\u8bc4\u6d4b\u4eba"} value={tester} onChange={e => setTester(e.target.value)} placeholder={"\u4f60\u7684\u540d\u5b57"} />
            <FInput label={"\u8bc4\u6d4b\u5907\u6ce8"} value={comment} onChange={e => setComment(e.target.value)} placeholder={"\u9009\u586b"} multiline />
            <FInput label={"\u4f18\u5316\u62a5\u544a\u94fe\u63a5"} value={reportLink} onChange={e => setReportLink(e.target.value)} placeholder={"\u9009\u586b"} />
            <button onClick={submitScore} style={{ width: "100%", padding: "10px", borderRadius: 8, cursor: passed !== null && tester ? "pointer" : "not-allowed", fontFamily: FONT_SANS, fontSize: 18, border: "1px solid rgba(0,0,0,0.06)", background: passed !== null && tester ? "rgba(0,0,0,0.1)" : "rgba(0,0,0,0.04)", color: passed !== null && tester ? "#3a2a18" : "#b5b0a5", opacity: passed !== null && tester ? 1 : 0.5 }}>{"\u63d0\u4ea4\u8bc4\u6d4b"}</button>
          </div>
          </>) : (
          <div style={{ padding: "20px 16px", textAlign: "center" }}>
            <Eye size={24} style={{ color: "#b5b0a5", marginBottom: 8 }} />
            <div style={{ fontFamily: FONT_SANS, fontSize: 15, color: "#a09888", lineHeight: 1.6 }}>{"\u5f53\u524d\u4e3a\u56e2\u961f\u6210\u5458\u89c6\u89d2"}<br/>{"\u8bc4\u6d4b\u64cd\u4f5c\u9700\u5207\u6362\u81f3\u6d4b\u8bd5\u5458\u6216\u7ba1\u7406\u5458\u89d2\u8272"}</div>
          </div>
          )}
          <div style={{ textAlign: "center", padding: "6px 0 10px", fontFamily: FONT_SANS, fontSize: 13, color: "#b5b0a5", borderTop: "1px solid rgba(0,0,0,0.05)" }}>{"\u70b9\u51fb\u5916\u90e8\u5173\u95ed"}</div>
        </div>
      </div>)}
    </>);
  }

  return (
    <div style={{ padding: "0 0 40px" }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "stretch" }}>
        <Stat label={"\u5f85\u8bc4\u6d4b"} value={pending.length} color="#b8861a" />
        <Stat label={"\u5df2\u901a\u8fc7"} value={done.filter(v=>v.passed).length} color="#4a8a4a" />
        <Stat label={"\u672a\u901a\u8fc7"} value={done.filter(v=>!v.passed).length} color="#b83a2a" />
        <Stat label={"\u8bc4\u5206\u7ef4\u5ea6"} value={dims.length} color="#8a8580" />
        {role === "admin" && <div onClick={()=>setShowDimMgr(true)} style={{background:"rgba(0,0,0,0.03)",borderRadius:10,padding:"8px 14px",border:"1px dashed rgba(0,0,0,0.08)",cursor:"pointer",display:"flex",alignItems:"center",gap:4}}
          onMouseEnter={e=>e.currentTarget.style.background="rgba(0,0,0,0.06)"} onMouseLeave={e=>e.currentTarget.style.background="rgba(0,0,0,0.03)"}>
          <Settings2 size={14} /><span style={{fontFamily:FONT_SANS,fontSize:15,color:"#a09888"}}>{"\u7ba1\u7406\u7ef4\u5ea6"}</span>
        </div>}
      </div>

      {pending.length > 0 && <TestDeskRow label={"\u5f85\u8bc4\u6d4b"} icon="flask" variants={pending} dims={dims} onSelect={openScore} onViewAll={()=>setBrowseType("pending")} />}
      {done.length > 0 && <TestDeskRow label={"\u5df2\u8bc4\u6d4b"} icon="clipboard" variants={done} dims={dims} onSelect={openScore} onViewAll={()=>setBrowseType("done")} />}
      {pending.length === 0 && done.length === 0 && <div style={{textAlign:"center",padding:"40px 20px",fontFamily:FONT_SANS,fontSize:18,color:"#a09888"}}>{"\u5de5\u5355\u53f0\u4e2d\u6682\u65e0\u65b9\u6848"}</div>}

      {/* 评分面板 */}
      {selVar && !browseType && (<div onClick={closeScore} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.4)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", opacity: showScore ? 1 : 0, pointerEvents: showScore ? "auto" : "none", transition: "opacity 0.3s" }}>
        <div onClick={e => e.stopPropagation()} style={{ width: 400, maxHeight: "85vh", background: "#fff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 14, boxShadow: "0 12px 40px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.06)", overflow: "auto", transform: showScore ? "scale(1) translateY(0)" : "scale(0.85) translateY(30px)", transition: "transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)" }}>
          <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: 16, color: "#3a2a18", lineHeight: 1.5 }}>{selVar.name}</div>
            <div style={{ fontFamily: FONT_SANS, fontSize: 15, color: "#9a8a68", marginTop: 4 }}>{"\u6240\u5c5e"}: {selVar.planName} · {selVar.uploader}</div>
          </div>
          {selVar.desc && <div style={{ padding: "8px 16px", borderBottom: "1px solid rgba(0,0,0,0.05)", fontFamily: FONT_SANS, fontSize: 15, color: "#4a4540" }}>{selVar.desc}</div>}
          {role !== "member" ? (<>
          <div style={{ padding: "12px 16px" }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: "#5a5550", marginBottom: 10 }}>{"\u9010\u9879\u8bc4\u5206"}</div>
            {activeDims.map(d => (<div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}><span style={{ fontFamily: FONT_SANS, fontSize: 16, color: "#4a4540" }}>{d.name}</span><StarRate value={scores[d.id] || 0} max={d.max} onChange={val => setScores(prev => ({ ...prev, [d.id]: val }))} /></div>))}
          </div>
          <div style={{ padding: "0 16px 12px" }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: "#5a5550", marginBottom: 8 }}>{"\u8bc4\u6d4b\u7ed3\u679c"}</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <button onClick={() => setPassed(true)} style={{ flex: 1, padding: "8px", borderRadius: 8, cursor: "pointer", fontFamily: FONT_SANS, fontSize: 17, border: passed === true ? "2px solid #4a8a4a" : "1px solid rgba(0,0,0,0.06)", background: passed === true ? "rgba(74,138,74,0.15)" : "rgba(255,255,255,0.3)", color: "#4a8a4a" }}><CheckCircle2 size={14} style={{verticalAlign:"middle",marginRight:4}} />{"\u901a\u8fc7"}</button>
              <button onClick={() => setPassed(false)} style={{ flex: 1, padding: "8px", borderRadius: 8, cursor: "pointer", fontFamily: FONT_SANS, fontSize: 17, border: passed === false ? "2px solid #b83a2a" : "1px solid rgba(0,0,0,0.06)", background: passed === false ? "rgba(184,58,42,0.15)" : "rgba(255,255,255,0.3)", color: "#b83a2a" }}><X size={14} style={{verticalAlign:"middle",marginRight:4}} />{"\u672a\u901a\u8fc7"}</button>
            </div>
            <FInput label={"\u8bc4\u6d4b\u4eba"} value={tester} onChange={e => setTester(e.target.value)} placeholder={"\u4f60\u7684\u540d\u5b57"} />
            <FInput label={"\u8bc4\u6d4b\u5907\u6ce8"} value={comment} onChange={e => setComment(e.target.value)} placeholder={"\u9009\u586b"} multiline />
            <FInput label={"\u4f18\u5316\u62a5\u544a\u94fe\u63a5"} value={reportLink} onChange={e => setReportLink(e.target.value)} placeholder={"\u9009\u586b"} />
            <button onClick={submitScore} style={{ width: "100%", padding: "10px", borderRadius: 8, cursor: passed !== null && tester ? "pointer" : "not-allowed", fontFamily: FONT_SANS, fontSize: 18, border: "1px solid rgba(0,0,0,0.06)", background: passed !== null && tester ? "rgba(0,0,0,0.1)" : "rgba(0,0,0,0.04)", color: passed !== null && tester ? "#3a2a18" : "#b5b0a5", opacity: passed !== null && tester ? 1 : 0.5 }}>{"\u63d0\u4ea4\u8bc4\u6d4b"}</button>
          </div>
          </>) : (
          <div style={{ padding: "20px 16px", textAlign: "center" }}>
            <Eye size={24} style={{ color: "#b5b0a5", marginBottom: 8 }} />
            <div style={{ fontFamily: FONT_SANS, fontSize: 15, color: "#a09888", lineHeight: 1.6 }}>{"\u5f53\u524d\u4e3a\u56e2\u961f\u6210\u5458\u89c6\u89d2"}<br/>{"\u8bc4\u6d4b\u64cd\u4f5c\u9700\u5207\u6362\u81f3\u6d4b\u8bd5\u5458\u6216\u7ba1\u7406\u5458\u89d2\u8272"}</div>
          </div>
          )}
          <div style={{ textAlign: "center", padding: "6px 0 10px", fontFamily: FONT_SANS, fontSize: 13, color: "#b5b0a5", borderTop: "1px solid rgba(0,0,0,0.05)" }}>{"\u70b9\u51fb\u5916\u90e8\u5173\u95ed"}</div>
        </div>
      </div>)}

      {/* 维度管理 */}
      {showDimMgr && (
        <FormModal title={"\u7ba1\u7406\u8bc4\u5206\u7ef4\u5ea6"} show={true} onClose={() => setShowDimMgr(false)}>
          {dims.map(d => (
            <div key={d.id} style={{ padding: "8px 0", borderBottom: "1px solid rgba(0,0,0,0.05)", opacity: d.active ? 1 : 0.45 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <input value={d.name} onChange={e => editDim(d.id, "name", e.target.value)} style={{ fontFamily: FONT_SANS, fontSize: 17, color: "#3a2a18", background: "transparent", border: "none", borderBottom: "1px dashed rgba(0,0,0,0.08)", outline: "none", padding: "0 0 2px", width: 120 }} />
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <button onClick={() => toggleDim(d.id)} style={{ padding: "2px 8px", borderRadius: 4, cursor: "pointer", fontFamily: FONT_SANS, fontSize: 13, border: d.active ? "1px solid rgba(74,138,74,0.4)" : "1px solid rgba(0,0,0,0.06)", background: d.active ? "rgba(74,138,74,0.12)" : "rgba(0,0,0,0.05)", color: d.active ? "#4a8a4a" : "#a89a78", transition: "all 0.15s" }}>{d.active ? "\u542f\u7528\u4e2d" : "\u5df2\u7981\u7528"}</button>
                  <button onClick={() => delDim(d.id)} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: FONT_SANS, fontSize: 13, color: "#b83a2a" }}>{"\u5220\u9664"}</button>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontFamily: FONT_SANS, fontSize: 13, color: "#9a8a68" }}>{"\u6ee1\u5206"}</span>
                {[3, 5, 10].map(n => (
                  <button key={n} onClick={() => editDim(d.id, "max", n)} style={{ padding: "1px 6px", borderRadius: 4, cursor: "pointer", fontFamily: FONT_SANS, fontSize: 13, border: d.max === n ? "1px solid rgba(0,0,0,0.15)" : "1px solid rgba(0,0,0,0.06)", background: d.max === n ? "rgba(0,0,0,0.08)" : "transparent", color: "#4a4540" }}>{n}</button>
                ))}
              </div>
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <input value={newDim} onChange={e => setNewDim(e.target.value)} placeholder={"\u65b0\u7ef4\u5ea6\u540d\u79f0"} style={{ flex: 1, padding: "6px 10px", background: "rgba(255,255,255,0.4)", border: "1px solid rgba(0,0,0,0.06)", borderRadius: 6, fontFamily: FONT_SANS, fontSize: 16, color: "#3a2a18", outline: "none" }} />
            <FBtn label={"\u6dfb\u52a0"} onClick={addDim} />
          </div>
        </FormModal>
      )}
    </div>
  );
}
