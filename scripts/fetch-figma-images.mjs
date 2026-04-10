#!/usr/bin/env node
/**
 * 메인 페이지 프로젝트 썸네일( 카드 Frame 9 )을 Figma에서 PNG @3x 로 받아 assets/projects/ 에 저장합니다.
 *
 * 사용법:
 *   export FIGMA_TOKEN="figd_..."   # Settings → Personal access tokens
 *   export FIGMA_FILE_KEY="abcXYZ..." # 파일 URL figma.com/design/이부분/...
 *   node scripts/fetch-figma-images.mjs
 *
 * @see https://www.figma.com/developers/api#get-images-endpoint
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outDir = path.join(root, "assets", "projects");

const EXPORTS = [
  { nodeId: "677:7369", filename: "thumb-awallet.png" },
  { nodeId: "711:7897", filename: "thumb-selflive.png" },
  { nodeId: "711:7912", filename: "thumb-invoice.png" },
  { nodeId: "711:7950", filename: "thumb-liveclass.png" },
  { nodeId: "711:7963", filename: "thumb-rallyz-ds.png" },
  { nodeId: "711:8636", filename: "thumb-sales-renewal.png" },
];

const token = process.env.FIGMA_TOKEN;
const fileKey = process.env.FIGMA_FILE_KEY;

async function main() {
  if (!token || !fileKey) {
    console.error(
      "FIGMA_TOKEN 과 FIGMA_FILE_KEY 환경 변수를 설정한 뒤 다시 실행하세요."
    );
    process.exit(1);
  }

  const params = new URLSearchParams();
  params.set("ids", EXPORTS.map((e) => e.nodeId).join(","));
  params.set("format", "png");
  params.set("scale", "3");

  const metaUrl = `https://api.figma.com/v1/images/${fileKey}?${params.toString()}`;
  const metaRes = await fetch(metaUrl, {
    headers: { "X-Figma-Token": token },
  });
  const meta = await metaRes.json();

  if (!metaRes.ok) {
    console.error("Figma API 오류:", meta.status, meta.err || meta);
    process.exit(1);
  }

  fs.mkdirSync(outDir, { recursive: true });

  for (const { nodeId, filename } of EXPORTS) {
    const imageUrl = meta.images && meta.images[nodeId];
    if (!imageUrl) {
      console.warn("URL 없음:", nodeId, filename);
      continue;
    }
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) {
      console.warn("다운로드 실패:", filename, imgRes.status);
      continue;
    }
    const buf = Buffer.from(await imgRes.arrayBuffer());
    const dest = path.join(outDir, filename);
    fs.writeFileSync(dest, buf);
    console.log("저장:", dest, `(${Math.round(buf.length / 1024)} KB)`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
