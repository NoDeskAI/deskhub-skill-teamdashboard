export const SKILLS = [
  { name: "PPT 生成", slug: "ppt-gen", status: "iterating", ver: "v1.2.0", cat: "skill", source: "官方", iters: 12, updated: "04-03", dl: 234, views: 1820, desc: "基于模板的智能PPT生成，支持多种风格切换。" },
  { name: "邮件撰写", slug: "email-writer", status: "iterating", ver: "v0.6.1", cat: "skill", source: "官方", iters: 6, updated: "04-01", dl: 312, views: 1560, desc: "商务邮件智能撰写与润色。" },
  { name: "图片生成", slug: "image-gen", status: "iterating", ver: "v0.9.3", cat: "skill", source: "社区", iters: 9, updated: "04-05", dl: 567, views: 3400, desc: "AI图片生成与编辑能力。" },
  { name: "办公套件", slug: "office-suite", status: "testing", ver: "v0.8.0", cat: "skill", source: "官方", iters: 8, updated: "04-04", dl: 156, views: 980, desc: "一站式办公文档处理。" },
  { name: "智能客服", slug: "smart-cs", status: "testing", ver: "v0.5.2", cat: "mcp", source: "第三方", iters: 5, updated: "04-02", dl: 89, views: 640, desc: "多轮对话客服机器人。" },
  { name: "视频剪辑", slug: "video-edit", status: "planned", ver: "v0.3.0", cat: "skill", source: "官方", iters: 3, updated: "03-28", dl: 67, views: 420, desc: "AI驱动的视频自动剪辑。" },
  { name: "语音转写", slug: "voice-asr", status: "planned", ver: "v0.1.0", cat: "mcp", source: "社区", iters: 1, updated: "03-25", dl: 22, views: 180, desc: "多语种语音实时转文字。" },
  { name: "数据分析", slug: "data-analysis", status: "stable", ver: "v2.1.0", cat: "skill", source: "官方", iters: 21, updated: "03-20", dl: 891, views: 4200, desc: "数据深度分析与可视化。" },
  { name: "文档翻译", slug: "doc-translate", status: "stable", ver: "v1.5.0", cat: "skill", source: "第三方", iters: 15, updated: "03-15", dl: 445, views: 2100, desc: "保留格式的全文档翻译。" },
  { name: "代码助手", slug: "code-assist", status: "stable", ver: "v1.8.2", cat: "skill", source: "官方", iters: 18, updated: "03-22", dl: 723, views: 5100, desc: "多语言代码补全与审查。" },
  { name: "PDF解析", slug: "pdf-reader", status: "stable", ver: "v2.0.1", cat: "skill", source: "官方", iters: 20, updated: "03-18", dl: 1102, views: 5800, desc: "PDF智能提取与结构化。" },
  { name: "表格处理", slug: "xlsx-tool", status: "stable", ver: "v1.6.0", cat: "skill", source: "官方", iters: 16, updated: "03-12", dl: 678, views: 3200, desc: "Excel读写、汇总、图表生成。" },
  { name: "思维导图", slug: "mindmap-gen", status: "stable", ver: "v1.3.0", cat: "skill", source: "社区", iters: 13, updated: "03-10", dl: 390, views: 1900, desc: "文本转思维导图，支持多种布局。" },
  { name: "日程管理", slug: "calendar-mgr", status: "stable", ver: "v1.1.0", cat: "mcp", source: "第三方", iters: 11, updated: "03-08", dl: 210, views: 1100, desc: "日历事件创建与提醒。" },
  { name: "文字转语音", slug: "tts-basic", status: "stable", ver: "v1.4.0", cat: "mcp", source: "官方", iters: 14, updated: "03-05", dl: 520, views: 2600, desc: "多角色文字转语音合成。" },
  { name: "网页摘要", slug: "web-summary", status: "stable", ver: "v1.7.0", cat: "skill", source: "官方", iters: 17, updated: "03-01", dl: 830, views: 4500, desc: "网页内容智能摘要与提炼。" },
  { name: "图片OCR", slug: "ocr-basic", status: "stable", ver: "v2.2.0", cat: "skill", source: "社区", iters: 22, updated: "02-28", dl: 960, views: 4800, desc: "图片文字识别，支持多语种。" },
  { name: "周报生成", slug: "weekly-report", status: "stable", ver: "v1.1.0", cat: "skill", source: "官方", iters: 11, updated: "03-08", dl: 567, views: 3100, desc: "智能周报/日报生成助手。" },
  { name: "合同审查", slug: "contract-review", status: "stable", ver: "v1.0.0", cat: "skill", source: "第三方", iters: 10, updated: "03-05", dl: 234, views: 1800, desc: "合同条款智能审查与风控。" },
  { name: "知识库", slug: "knowledge-base", status: "stable", ver: "v2.3.0", cat: "mcp", source: "官方", iters: 23, updated: "03-25", dl: 1456, views: 7200, desc: "企业知识库管理与RAG检索。" },
  { name: "文件转换", slug: "file-convert", status: "stable", ver: "v1.4.0", cat: "skill", source: "官方", iters: 14, updated: "03-02", dl: 678, views: 3800, desc: "多格式文件互转（docx/pdf/md）。" },
];

export const INIT_PLANS = [
  { id: "p1", name: "PPT 生成优化", period: "current", priority: "high", created: "04-01", desc: "对标主流PPT方案，选择最优路径进行迭代。", selected: null, variants: [
    { id: "v1", name: "NotebookLM 方案", uploader: "小东", uploaded: "04-02", tested: true, passed: true, desc: "基于Google NotebookLM的文档解析+幻灯片生成流程", link: "https://example.com/plan-v1" },
    { id: "v2", name: "MiniMax 方案", uploader: "笑不语", uploaded: "04-02", tested: true, passed: false, desc: "调用MiniMax API直接生成幻灯片，稳定性不足", link: "" },
    { id: "v3", name: "Manus 方案", uploader: "小东", uploaded: "04-03", tested: false, passed: null, desc: "Manus Agent多步生成，质量高但速度慢", link: "" },
    { id: "v4", name: "Accio 方案", uploader: "笑不语", uploaded: "04-03", tested: false, passed: null, desc: "", link: "" },
  ]},
  { id: "p2", name: "办公套件整合", period: "current", priority: "medium", created: "04-02", desc: "将Word/Excel/PDF能力整合为统一入口。", selected: "v5", variants: [
    { id: "v5", name: "分离式方案", uploader: "笑不语", uploaded: "04-03", tested: true, passed: true, desc: "每种格式独立 Skill，通过路由分发", link: "" },
    { id: "v6", name: "一体化方案", uploader: "小东", uploaded: "04-04", tested: false, passed: null, desc: "单个 Skill 内部判断文件类型并处理", link: "" },
  ]},
  { id: "p3", name: "视频剪辑技能", period: "next", priority: "high", created: "04-03", desc: "新增 AI 视频自动剪辑能力。", selected: null, variants: [
    { id: "v7", name: "基于Seedance方案", uploader: "笑不语", uploaded: "04-04", tested: false, passed: null, desc: "使用Seedance 2.0视频生成+剪辑工作流", link: "" },
  ]},
  { id: "p4", name: "语音转写探索", period: "next", priority: "low", created: "04-04", desc: "调研多语种语音转写方案可行性。", selected: null, variants: [] },
];

export const MCPS = [
  { id: "m1", name: "文件读写", slug: "file-rw", status: "stable", ver: "v1.3.0", desc: "本地文件的读取、写入、追加操作", updated: "03-28", maintainer: "笑不语" },
  { id: "m2", name: "浏览器操作", slug: "browser-ctrl", status: "stable", ver: "v1.1.0", desc: "网页截图、表单填写、页面导航", updated: "03-25", maintainer: "小东" },
  { id: "m3", name: "数据库查询", slug: "db-query", status: "iterating", ver: "v0.8.0", desc: "PostgreSQL/MySQL 数据库连接与查询", updated: "04-03", maintainer: "笑不语" },
  { id: "m4", name: "邮件发送", slug: "email-send", status: "iterating", ver: "v0.5.1", desc: "SMTP邮件发送与模板管理", updated: "04-01", maintainer: "小东" },
  { id: "m5", name: "OCR识别", slug: "ocr", status: "planned", ver: "v0.1.0", desc: "图片文字识别，支持多语种", updated: "03-30", maintainer: "待定" },
  { id: "m6", name: "语音合成", slug: "tts", status: "planned", ver: "v0.1.0", desc: "文字转语音，多角色多语种", updated: "04-02", maintainer: "待定" },
];

export const INIT_MCP_REQS = [
  { id: "mr1", name: "网页爬虫能力", priority: "high", created: "04-03", desc: "希望新增通用网页爬虫MCP，支持动态渲染页面的数据提取。", submitter: "笑不语", status: "reviewing" },
  { id: "mr2", name: "日历/日程管理", priority: "medium", created: "04-04", desc: "对接Google Calendar或本地日历，支持创建和查询日程。", submitter: "小东", status: "accepted" },
];

export const INIT_DIMS = [
  { id: "d1", name: "准确性", max: 5, active: true },
  { id: "d2", name: "稳定性", max: 5, active: true },
  { id: "d3", name: "用户体验", max: 5, active: true },
];
