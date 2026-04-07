import { useState, useCallback } from "react";
import { nPid, nVid, td } from "../../utils/helpers.js";
import { FONT_SANS } from "../../constants/theme.js";
import Stat from "../../components/ui/Stat.jsx";
import { FormModal, FInput, FSelect, FBtn } from "../../components/ui/Form.jsx";
import PlanDeskRow from "./PlanDeskRow.jsx";
import PlanBrowse from "./PlanBrowse.jsx";
import PlanDetail from "./PlanDetail.jsx";

export default function WorkBench({ plans, setPlans, role }) {
  const [sel, setSel] = useState(null); const [showDet, setShowDet] = useState(false);
  const [browseP, setBrowseP] = useState(null);
  const [fMode, setFMode] = useState(null); const [fData, setFData] = useState({});

  const curP = plans.filter(p => p.period === "current"); const nxtP = plans.filter(p => p.period === "next");

  const openDet = useCallback(plan => { setSel(plan); setTimeout(() => setShowDet(true), 30); }, []);
  const closeDet = useCallback(() => { setShowDet(false); setTimeout(() => setSel(null), 350); }, []);

  const openCreate = () => { setFMode("create"); setFData({ name: "", period: "current", priority: "medium", desc: "" }); };
  const openEdit = () => { if (!sel) return; setFMode("edit"); setFData({ name: sel.name, period: sel.period, priority: sel.priority, desc: sel.desc }); };
  const openAddVar = () => { setFMode("addVar"); setFData({ name: "", uploader: "", desc: "", link: "" }); };
  const openEditVar = (v) => { setFMode("editVar"); setFData({ vid: v.id, name: v.name, uploader: v.uploader, desc: v.desc || "", link: v.link || "" }); };

  const save = () => {
    if (fMode === "create") { setPlans(prev => [...prev, { id: nPid(), name: fData.name || "新工单", period: fData.period, priority: fData.priority, created: td(), desc: fData.desc || "", selected: null, variants: [] }]); }
    else if (fMode === "edit" && sel) { setPlans(prev => prev.map(p => p.id === sel.id ? { ...p, name: fData.name, period: fData.period, priority: fData.priority, desc: fData.desc } : p)); setSel(prev => prev ? { ...prev, name: fData.name, period: fData.period, priority: fData.priority, desc: fData.desc } : null); }
    else if (fMode === "addVar" && sel) { const nv = { id: nVid(), name: fData.name || "新方案", uploader: fData.uploader || "未知", uploaded: td(), tested: false, passed: null, desc: fData.desc || "", link: fData.link || "" }; setPlans(prev => prev.map(p => p.id === sel.id ? { ...p, variants: [...p.variants, nv] } : p)); setSel(prev => prev ? { ...prev, variants: [...prev.variants, nv] } : null); }
    else if (fMode === "editVar" && sel) { const upd = v => v.id === fData.vid ? { ...v, name: fData.name, uploader: fData.uploader, desc: fData.desc, link: fData.link } : v; setPlans(prev => prev.map(p => p.id === sel.id ? { ...p, variants: p.variants.map(upd) } : p)); setSel(prev => prev ? { ...prev, variants: prev.variants.map(upd) } : null); }
    setFMode(null);
  };
  const del = () => { if (!sel) return; setPlans(prev => prev.filter(p => p.id !== sel.id)); closeDet(); };
  const selVar = vid => { setPlans(prev => prev.map(p => p.id === sel.id ? { ...p, selected: vid } : p)); setSel(prev => prev ? { ...prev, selected: vid } : null); };
  const delVar = vid => { setPlans(prev => prev.map(p => p.id === sel.id ? { ...p, variants: p.variants.filter(v => v.id !== vid), selected: p.selected === vid ? null : p.selected } : p)); setSel(prev => prev ? { ...prev, variants: prev.variants.filter(v => v.id !== vid), selected: prev.selected === vid ? null : prev.selected } : null); };

  const browseSelect = useCallback(plan => { const f = plans.find(p => p.id === plan.id) || plan; openDet(f); }, [plans, openDet]);

  const varForm = (fMode === "addVar" || fMode === "editVar") && <>
    <FInput label="方案名称" value={fData.name} onChange={e => setFData(p => ({ ...p, name: e.target.value }))} placeholder="如 NotebookLM 方案" />
    <FInput label="上传人" value={fData.uploader} onChange={e => setFData(p => ({ ...p, uploader: e.target.value }))} />
    <FInput label="方案说明" value={fData.desc} onChange={e => setFData(p => ({ ...p, desc: e.target.value }))} placeholder="简述技术路线、优缺点等" multiline />
    <FInput label="文件/链接" value={fData.link} onChange={e => setFData(p => ({ ...p, link: e.target.value }))} placeholder="方案文档地址（选填）" />
    <FBtn label={fMode === "addVar" ? "添加" : "保存"} onClick={save} full />
  </>;

  const formUI = fMode && (
    <FormModal title={fMode === "create" ? "新建工单" : fMode === "edit" ? "编辑工单" : fMode === "addVar" ? "添加方案" : "编辑方案"} show={true} onClose={() => setFMode(null)}>
      {(fMode === "create" || fMode === "edit") && <>
        <FInput label="工单名称" value={fData.name} onChange={e => setFData(p => ({ ...p, name: e.target.value }))} placeholder="如 PPT生成优化" />
        <FSelect label="周期" value={fData.period} onChange={v => setFData(p => ({ ...p, period: v }))} options={[{ v: "current", l: "当期" }, { v: "next", l: "下期" }]} />
        <FSelect label="优先级" value={fData.priority} onChange={v => setFData(p => ({ ...p, priority: v }))} options={[{ v: "high", l: "高", c: "#b83a2a" }, { v: "medium", l: "中", c: "#b8861a" }, { v: "low", l: "低", c: "#5a8a5a" }]} />
        <FInput label="描述" value={fData.desc} onChange={e => setFData(p => ({ ...p, desc: e.target.value }))} multiline />
        <FBtn label={fMode === "create" ? "创建" : "保存"} onClick={save} full />
      </>}
      {(fMode === "addVar" || fMode === "editVar") && varForm}
    </FormModal>
  );

  if (browseP) {
    const bp = browseP === "current" ? curP : nxtP;
    return (<>{formUI}<PlanBrowse label={browseP === "current" ? "当期重点" : "下期规划"} icon={browseP === "current" ? "hammer" : "scroll"} plans={bp} onBack={() => setBrowseP(null)} onSelect={browseSelect} /><PlanDetail plan={sel} onClose={closeDet} show={showDet} onEdit={openEdit} onDelete={del} onAddVar={openAddVar} onEditVar={openEditVar} onSelVar={selVar} onDelVar={delVar} role={role} /></>);
  }

  return (
    <div style={{ padding: "0 0 40px" }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "stretch" }}>
        <Stat label="工单总数" value={plans.length} color="#c4a870" />
        <Stat label="当期重点" value={curP.length} color="#b85c1a" />
        <Stat label="下期规划" value={nxtP.length} color="#3a6a3a" />
        <Stat label="总方案数" value={plans.reduce((a, p) => a + p.variants.length, 0)} color="#8a8580" />
        {role === "admin" && <div onClick={openCreate} style={{ background: "rgba(0,0,0,0.03)", borderRadius: 10, padding: "8px 14px", border: "1px dashed rgba(0,0,0,0.08)", textAlign: "center", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, transition: "all 0.2s" }}
          onMouseEnter={e => e.currentTarget.style.background = "rgba(0,0,0,0.06)"} onMouseLeave={e => e.currentTarget.style.background = "rgba(0,0,0,0.03)"}>
          <span style={{ fontSize: 16 }}>+</span><span style={{ fontFamily: FONT_SANS, fontSize: 15, color: "#a09888" }}>新建工单</span>
        </div>}
      </div>
      {curP.length > 0 && <PlanDeskRow label="当期重点" icon="hammer" plans={curP} onSelect={p => { const f = plans.find(x => x.id === p.id) || p; openDet(f); }} onViewAll={() => setBrowseP("current")} />}
      {nxtP.length > 0 && <PlanDeskRow label="下期规划" icon="scroll" plans={nxtP} onSelect={p => { const f = plans.find(x => x.id === p.id) || p; openDet(f); }} onViewAll={() => setBrowseP("next")} />}
      <PlanDetail plan={sel} onClose={closeDet} show={showDet} onEdit={openEdit} onDelete={del} onAddVar={openAddVar} onEditVar={openEditVar} onSelVar={selVar} onDelVar={delVar} role={role} />
      {formUI}
    </div>
  );
}
