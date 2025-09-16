import { NextRequest, NextResponse } from "next/server";
import { XMLParser } from "fast-xml-parser";

export async function GET(req: NextRequest) {
  const url =
    req.nextUrl.searchParams.get("url") ||
    "https://www.ourcommons.ca/Content/House/451/Debates/021/HAN021-E.XML";

  try {
    const res = await fetch(url);
    if (!res.ok) {
      return NextResponse.json(
        { error: `Failed to fetch XML: ${res.status}` },
        { status: 500 }
      );
    }
    const xml = await res.text();

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
    });
    const obj = parser.parse(xml);

    const speeches: any[] = [];

    function extractFromSpeechNode(s: any) {
      if (!s) return;
      const speaker =
        typeof s.speaker === "string"
          ? s.speaker
          : s.speaker?.["#text"] || null;
      const timestamp = s["@_time"] || null;

      // Handle ParaText instead of <p>
      const paras = Array.isArray(s.ParaText)
        ? s.ParaText
        : s.ParaText
        ? [s.ParaText]
        : [];
      const text = paras
        .map((p: any) =>
          typeof p === "string" ? p.trim() : p?.["#text"]?.trim() || ""
        )
        .filter(Boolean)
        .join("\n\n");

      if (text) {
        speeches.push({ speaker, timestamp, text });
      }
    }

    function walk(node: any) {
      if (!node || typeof node !== "object") return;

      if (node.speech) {
        const list = Array.isArray(node.speech) ? node.speech : [node.speech];
        list.forEach(extractFromSpeechNode);
      }

      for (const key of Object.keys(node)) {
        const child = node[key];
        if (typeof child === "object") {
          if (Array.isArray(child)) child.forEach((c) => walk(c));
          else walk(child);
        }
      }
    }

    walk(obj);

    return NextResponse.json({ speeches });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
