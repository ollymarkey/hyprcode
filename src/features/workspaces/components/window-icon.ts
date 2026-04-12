import { MessageSquare, Monitor, Terminal } from "lucide-react";
import type { WindowType } from "../types";

export function getWindowTypeIcon(type: WindowType) {
  switch (type) {
    case "chat":
      return MessageSquare;
    case "terminal":
      return Terminal;
    case "editor":
      return Monitor;
    default:
      return Monitor;
  }
}
