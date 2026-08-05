// Minimal JSON -> YAML serializer (no dependencies) used to publish openapi.yaml.
function needsQuotes(s: string): boolean {
  return (
    s === "" ||
    /^[\s]|[\s]$/.test(s) ||
    /^[-?:,[\]{}#&*!|>'"%@`]/.test(s) ||
    /:\s/.test(s) ||
    /^(true|false|null|yes|no|on|off|~)$/i.test(s) ||
    /^[-+]?[0-9.]+([eE][-+]?[0-9]+)?$/.test(s) ||
    s.includes("\n")
  );
}

function scalar(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  const s = String(value);
  if (!needsQuotes(s)) return s;
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;
}

export function toYaml(value: unknown, indent = 0): string {
  const pad = "  ".repeat(indent);

  if (Array.isArray(value)) {
    if (value.length === 0) return `${pad}[]`;
    return value
      .map((item) => {
        if (item !== null && typeof item === "object") {
          const body = toYaml(item, indent + 1);
          return `${pad}-\n${body}`;
        }
        return `${pad}- ${scalar(item)}`;
      })
      .join("\n");
  }

  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).filter(
      ([, v]) => v !== undefined,
    );
    if (entries.length === 0) return `${pad}{}`;
    return entries
      .map(([key, v]) => {
        const k = needsQuotes(key) ? `"${key}"` : key;
        if (v !== null && typeof v === "object") {
          const isEmpty = Array.isArray(v) ? v.length === 0 : Object.keys(v).length === 0;
          if (isEmpty) return `${pad}${k}: ${Array.isArray(v) ? "[]" : "{}"}`;
          return `${pad}${k}:\n${toYaml(v, indent + 1)}`;
        }
        return `${pad}${k}: ${scalar(v)}`;
      })
      .join("\n");
  }

  return `${pad}${scalar(value)}`;
}
