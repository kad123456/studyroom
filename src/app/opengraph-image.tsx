import { ImageResponse } from "next/og";

export const alt = "StudyRoom — focus together online";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "76px",
          color: "white",
          background: "linear-gradient(135deg, #101426 0%, #211247 55%, #382178 100%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "18px", fontSize: 28, color: "#c4b5fd" }}>
          <div style={{ width: 52, height: 52, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 16, background: "linear-gradient(135deg, #9333ea, #4f46e5)", color: "white", fontSize: 30, fontWeight: 700 }}>S</div>
          StudyRoom
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 54, fontSize: 68, lineHeight: 1.12, fontWeight: 700, letterSpacing: -2 }}>
          <span>Focus together.</span>
          <span>Study online with friends.</span>
        </div>
        <div style={{ marginTop: 28, fontSize: 28, color: "#d1d5db" }}>
          Free virtual study rooms · Shared Pomodoro timer · No sign-up
        </div>
      </div>
    ),
    { ...size },
  );
}
