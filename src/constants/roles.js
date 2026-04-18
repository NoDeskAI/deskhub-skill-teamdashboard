import { Shield, FlaskConical, Eye } from "lucide-react";
import { ROLES as _ROLES } from "../../shared/constants/roles.js";

const ICON_MAP = { admin: Shield, tester: FlaskConical, member: Eye };

// 前端 wrapper：纯数据从 shared/ 来，lucide Icon 在此处按 id 注入
export const ROLES = _ROLES.map(r => ({ ...r, Icon: ICON_MAP[r.id] }));
