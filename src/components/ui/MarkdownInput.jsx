import { useState, useRef, useCallback } from "react";
import { Upload } from "lucide-react";
import { FONT_MONO, FONT_SANS } from "../../constants/theme.js";

/**
 * Markdown 编辑输入 — 手写 + 拖拽/点选 .md 文件自动解析
 * 拖入或选择 .md 文件后，用 FileReader 读取文本内容填入 textarea
 */
export default function MarkdownInput({ value, onChange, placeholder, minHeight = 140 }) {
  const [dragging, setDragging] = useState(false);
  const dragCounter = useRef(0);
  const fileRef = useRef(null);

  const readFile = useCallback((file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result || "";
      onChange(value ? value + "\n\n" + text : text);
    };
    reader.readAsText(file, "utf-8");
  }, [value, onChange]);

  const acceptFile = useCallback((file) => {
    if (!file) return false;
    const name = file.name.toLowerCase();
    if (name.endsWith(".md") || name.endsWith(".markdown") || name.endsWith(".txt") || file.type === "text/markdown" || file.type === "text/plain") {
      return true;
    }
    return false;
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    dragCounter.current = 0;
    const files = Array.from(e.dataTransfer?.files || []);
    const mdFile = files.find(acceptFile);
    if (mdFile) readFile(mdFile);
  }, [readFile, acceptFile]);

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (dragCounter.current === 1) setDragging(true);
  };
  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) setDragging(false);
  };
  const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file && acceptFile(file)) readFile(file);
    e.target.value = "";
  };

  return (
    <div
      style={{ position: "relative" }}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%", minHeight, padding: "10px 12px",
          background: dragging ? "rgba(90,122,154,0.06)" : "rgba(0,0,0,0.02)",
          border: dragging ? "2px dashed rgba(90,122,154,0.4)" : "1px solid rgba(0,0,0,0.08)",
          borderRadius: 8, fontFamily: FONT_MONO, fontSize: 13,
          color: "#3a2a18", lineHeight: 1.6, resize: "vertical",
          outline: "none", boxSizing: "border-box",
          transition: "border-color 0.15s, background 0.15s",
        }}
      />

      {/* 拖拽覆盖提示 */}
      {dragging && (
        <div style={{
          position: "absolute", inset: 0, borderRadius: 8,
          background: "rgba(90,122,154,0.08)",
          display: "flex", alignItems: "center", justifyContent: "center",
          pointerEvents: "none",
        }}>
          <div style={{ fontFamily: FONT_SANS, fontSize: 13, color: "#5a7a9a", fontWeight: 500 }}>
            松开以导入 .md 文件
          </div>
        </div>
      )}

      {/* 底部提示栏：上传 .md 按钮 */}
      <input ref={fileRef} type="file" accept=".md,.markdown,.txt" style={{ display: "none" }} onChange={handleFileSelect} />
      <div style={{
        display: "flex", justifyContent: "flex-end", marginTop: 4,
      }}>
        <span
          onClick={() => fileRef.current?.click()}
          style={{
            display: "inline-flex", alignItems: "center", gap: 3,
            fontFamily: FONT_SANS, fontSize: 11, color: "#9a8a78",
            cursor: "pointer", userSelect: "none",
            padding: "2px 6px", borderRadius: 4,
            transition: "color 0.15s",
          }}
          onMouseEnter={e => e.currentTarget.style.color = "#5a7a9a"}
          onMouseLeave={e => e.currentTarget.style.color = "#9a8a78"}
        >
          <Upload size={10} />导入 .md
        </span>
      </div>
    </div>
  );
}
