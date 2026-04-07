import { useState, useRef, useEffect, useCallback } from "react";
import { Inbox, X } from "lucide-react";
import { PRI } from "../../constants/priority.js";
import { MR_ST } from "../../constants/status.js";
import { FONT_MONO, FONT_SANS } from "../../constants/theme.js";
import DetailModal from "../../components/ui/DetailModal.jsx";
import McpReqCard from "./McpReqCard.jsx";

export default function McpReqPool({ reqs, setReqs, role }) {
  const [reqHandOpen, setReqHandOpen] = useState(false);
  const [reqHoverIdx, setReqHoverIdx] = useState(null);
  const [reqFocusIdx, setReqFocusIdx] = useState(null);
  const [reqFocusPhase, setReqFocusPhase] = useState(null);
  const [reqFocusItem, setReqFocusItem] = useState(null);
  const reqRef = useRef(null); const [reqW, setReqW] = useState(700);
  const reqOff = useRef({});
  const REQ_MAX = 7;
  reqs.slice(0, REQ_MAX).forEach(r => { if(!reqOff.current[r.id]) reqOff.current[r.id] = { rx:(Math.random()-0.5)*6, ry:(Math.random()-0.5)*4, rot:(Math.random()-0.5)*10 }; });
  useEffect(() => { const fn=()=>{if(reqRef.current)setReqW(reqRef.current.getBoundingClientRect().width);}; fn(); window.addEventListener("resize",fn); return ()=>window.removeEventListener("resize",fn); }, []);
  const reqHandCards = reqs.slice(0, REQ_MAX); const reqHandExtra = reqs.length - REQ_MAX;
  const reqHN = reqHandCards.length; const reqCardW = 126;
  const reqMaxSpread = reqW - reqCardW - 40;
  const reqSpacing = reqHN > 1 ? Math.min(reqMaxSpread / (reqHN - 1), 110) : 0;
  const reqTotalW = reqHN > 1 ? reqSpacing * (reqHN - 1) + reqCardW : reqCardW;
  const reqStartX = (reqW - reqTotalW) / 2; const reqHCenter = (reqHN - 1) / 2;
  const reqMaxAngle = Math.min(reqHN * 2.5, 16); const reqArcK = Math.min(2.5, 30 / Math.max(reqHN, 1));
  const handleReqFocus = useCallback((item, i) => {
    if (reqFocusPhase) return;
    setReqFocusIdx(i); setReqFocusItem(item); setReqHoverIdx(null);
    setReqFocusPhase("fly-up");
    setTimeout(() => setReqFocusPhase("dissolve"), 450);
    setTimeout(() => { setReqFocusPhase("detail"); }, 750);
  }, [reqFocusPhase]);
  const handleReqDetailClose = useCallback(() => {
    setReqFocusPhase("condense");
    setTimeout(() => setReqFocusPhase("fly-back"), 300);
    setTimeout(() => { setReqFocusPhase(null); setReqFocusIdx(null); setReqFocusItem(null); }, 750);
  }, []);
  const getReqCenterDelta = (i) => {
    const offset = i - reqHCenter; const yUp = offset * offset * reqArcK;
    const cl = reqStartX + i * reqSpacing; const ct = 18 + yUp;
    const r = reqRef.current?.getBoundingClientRect();
    if (!r) return { dx:0, dy:-120, cl, ct };
    return { dx: (window.innerWidth/2)-r.left-cl-reqCardW/2, dy: (window.innerHeight*0.38)-r.top-ct-82, cl, ct };
  };

  return (
    <div style={{ marginBottom: 12, position: "relative", zIndex: reqHandOpen ? 50 : 1 }}>
      {reqHandOpen && <div onClick={() => { if (!reqFocusPhase) setReqHandOpen(false); }} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.15)", zIndex:40 }} />}
      <div ref={reqRef} style={{ position:"relative", height:200, zIndex: reqHandOpen?45:1, background:"linear-gradient(180deg, #ede8e0, #e8e2d8)", borderRadius:14, border: reqHandOpen?"1px solid rgba(0,0,0,0.08)":"1px solid rgba(0,0,0,0.05)", boxShadow: reqHandOpen?"0 4px 16px rgba(0,0,0,0.08)":"0 1px 4px rgba(0,0,0,0.04)", overflow: reqHandOpen?"visible":"hidden", transition:"all 0.3s ease" }}>
        {[40,85,130,170].map((y,i)=>(<div key={i} style={{position:"absolute",left:0,right:0,top:y,height:1,background:"rgba(0,0,0,0.03)"}}/>))}
        <div onClick={() => reqHandOpen ? (reqFocusPhase ? null : setReqHandOpen(false)) : null} style={{ position:"absolute", right:0, top:0, bottom:0, left: reqHandOpen ? "100%" : (20 + (Math.min(reqs.length,5)-1)*38 + reqCardW + 20), padding: reqHandOpen ? 0 : "14px 16px", display:"flex", flexDirection:"column", justifyContent:"center", gap:6, cursor:"pointer", opacity: reqHandOpen?0:1, overflow:"hidden", transition:"opacity 0.3s, left 0.4s", borderLeft:"none" }}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}><Inbox size={16} /><span style={{fontFamily:FONT_MONO,fontSize:13,color:"#4a4540"}}>需求池</span><span style={{fontSize:14,color:"#a09888",marginLeft:4}}>{reqs.length} 条需求</span></div>
          <div style={{fontSize:13,color:"#a09888"}}>审核中 {reqs.filter(r=>r.status==="reviewing").length} · 已采纳 {reqs.filter(r=>r.status==="accepted").length}</div>
          <div style={{fontSize:12,color:"#c0b5a5"}}>点击展开 ▶</div>
        </div>
        {reqHandCards.map((r, i) => {
          const hovered = reqHoverIdx === i; let sty;
          if (!reqHandOpen) {
            const po = reqOff.current[r.id] || {rx:0,ry:0,rot:0};
            if (i<5) { sty={left:20+i*38+po.rx,top:18+po.ry,transform:"rotate("+po.rot+"deg)"+(hovered?" translateY(-6px) scale(1.05)":""),zIndex:hovered?50:i+1,transition:"all 0.35s ease"}; }
            else { sty={left:20+4*38+po.rx,top:18+po.ry,transform:"rotate("+po.rot+"deg) scale(0.92)",zIndex:0,opacity:0,transition:"all 0.35s ease"}; }
          } else {
            const offset=i-reqHCenter; const normOff=reqHN>1?offset/reqHCenter:0; const angle=normOff*reqMaxAngle; const yUp=offset*offset*reqArcK;
            const isFocused=reqFocusIdx===i; const otherFocused=reqFocusIdx!==null&&reqFocusIdx!==i;
            if (isFocused && reqFocusPhase) {
              const {dx,dy,cl,ct}=getReqCenterDelta(i);
              if (reqFocusPhase==="fly-up") sty={left:cl,top:ct,transform:`translate(${dx}px,${dy}px) scale(1.25)`,opacity:1,zIndex:500,filter:"drop-shadow(0 20px 50px rgba(0,0,0,0.5))",transition:"all 0.45s cubic-bezier(0.34,1.4,0.64,1)"};
              else if (reqFocusPhase==="dissolve"||reqFocusPhase==="detail") sty={left:cl,top:ct,transform:`translate(${dx}px,${dy}px) scale(1.6)`,opacity:0,zIndex:reqFocusPhase==="detail"?0:500,transition:reqFocusPhase==="detail"?"none":"all 0.3s ease-in"};
              else if (reqFocusPhase==="condense") sty={left:cl,top:ct,transform:`translate(${dx}px,${dy}px) scale(1.25)`,opacity:1,zIndex:500,filter:"drop-shadow(0 20px 50px rgba(0,0,0,0.5))",transition:"all 0.3s ease-out"};
              else sty={left:reqStartX+i*reqSpacing,top:18+yUp,transform:`rotate(${angle}deg) scale(1)`,opacity:1,zIndex:100,transition:"all 0.45s cubic-bezier(0.25,1,0.5,1)"};
            } else {
              sty={left:reqStartX+i*reqSpacing, top:hovered&&!otherFocused?Math.max(2,16-yUp):18+yUp, transform:`rotate(${hovered&&!otherFocused?0:angle}deg) scale(${otherFocused?0.92:hovered?1.12:1})`, zIndex:hovered&&!otherFocused?200:100-Math.round(Math.abs(offset)), filter:hovered&&!otherFocused?"drop-shadow(0 8px 20px rgba(0,0,0,0.4))":"none", opacity:otherFocused?0.3:1, transition:`all 0.4s cubic-bezier(0.25,1,0.5,1) ${reqFocusIdx!==null?0:i*0.04}s`};
            }
          }
          return <McpReqCard key={r.id} r={r} style={sty} hovered={hovered&&!reqFocusPhase} onHover={()=>!reqFocusPhase&&setReqHoverIdx(i)} onLeave={()=>setReqHoverIdx(null)} onClick={e=>{e.stopPropagation();if(!reqHandOpen)setReqHandOpen(true);else if(!reqFocusPhase)handleReqFocus(r,i);}} />;
        })}
        {reqHandOpen && !reqFocusPhase && (
          <div style={{position:"absolute",bottom:8,right:12,display:"flex",gap:8,zIndex:210}}>
            {reqHandExtra>0 && <button onClick={e=>{e.stopPropagation();setReqHandOpen(false);}} style={{background:"rgba(0,0,0,0.06)",border:"1px solid rgba(0,0,0,0.06)",borderRadius:8,padding:"4px 10px",cursor:"pointer",fontSize:12,color:"#6a5a45"}}>还有 {reqHandExtra} 条 →</button>}
            <button onClick={e=>{e.stopPropagation();setReqHandOpen(false);}} style={{background:"rgba(0,0,0,0.06)",border:"1px solid rgba(0,0,0,0.06)",borderRadius:8,padding:"4px 10px",cursor:"pointer",fontSize:12,color:"#8a7a65"}}><X size={12} style={{verticalAlign:"middle"}} /> 收起</button>
          </div>
        )}
      </div>
      {reqFocusItem && reqFocusPhase === "detail" && (
        <DetailModal show={true} onClose={handleReqDetailClose} width={380}>
          <div style={{padding:"14px 16px 10px",borderBottom:"1px solid rgba(0,0,0,0.06)"}}>
            <div style={{fontFamily:FONT_MONO,fontSize:16,color:"#3a2a18",lineHeight:1.5}}>{reqFocusItem.name}</div>
            <div style={{display:"flex",gap:6,marginTop:6,flexWrap:"wrap"}}>
              <span style={{padding:"2px 7px",background:PRI[reqFocusItem.priority].bg,borderRadius:6,fontFamily:FONT_SANS,fontSize:14,color:PRI[reqFocusItem.priority].c}}>{PRI[reqFocusItem.priority].l}</span>
              <span style={{padding:"2px 7px",background:"rgba(0,0,0,0.05)",borderRadius:6,fontFamily:FONT_SANS,fontSize:14,color:MR_ST[reqFocusItem.status].c}}>{MR_ST[reqFocusItem.status].l}</span>
              <span style={{fontFamily:FONT_SANS,fontSize:14,color:"#a89a78"}}>{reqFocusItem.submitter} · {reqFocusItem.created}</span>
            </div>
          </div>
          <div style={{padding:"10px 16px",borderBottom:"1px solid rgba(0,0,0,0.06)",fontFamily:FONT_SANS,fontSize:15,color:"#4a4540",lineHeight:1.5}}>{reqFocusItem.desc}</div>
          {role === "admin" && <div style={{padding:"10px 16px"}}>
            <div style={{fontFamily:FONT_SANS,fontSize:13,color:"#5a5550",marginBottom:8}}>设置状态</div>
            <div style={{display:"flex",gap:6}}>
              {[{v:"reviewing",l:"审核中"},{v:"accepted",l:"采纳"},{v:"rejected",l:"搁置"}].map(o => (
                <button key={o.v} onClick={()=>{const updated={...reqFocusItem,status:o.v};setReqFocusItem(updated);setReqs(prev=>prev.map(r=>r.id===reqFocusItem.id?{...r,status:o.v}:r));}} style={{flex:1,padding:"6px",borderRadius:6,cursor:"pointer",fontFamily:FONT_SANS,fontSize:14,border:reqFocusItem.status===o.v?"2px solid "+MR_ST[o.v].c:"1px solid rgba(0,0,0,0.06)",background:reqFocusItem.status===o.v?MR_ST[o.v].c+"18":"rgba(255,255,255,0.3)",color:MR_ST[o.v].c}}>{o.l}</button>
              ))}
            </div>
          </div>}
        </DetailModal>
      )}
    </div>
  );
}
