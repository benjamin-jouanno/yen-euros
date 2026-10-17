export function IconArt({ fontSize }: { fontSize: number }) {
  return (
    <div
      style={{
        alignItems: "center",
        background: "#203e32",
        borderRadius: "24%",
        color: "#fff9ec",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        justifyContent: "center",
        width: "100%",
      }}
    >
      <span
        style={{
          fontFamily: "Georgia",
          fontSize,
          lineHeight: 0.92,
        }}
      >
        ¥
      </span>
      <span
        style={{
          color: "#efad73",
          fontFamily: "Arial",
          fontSize: fontSize * 0.34,
          lineHeight: 0.75,
          marginLeft: 7,
        }}
      >
        ↔
      </span>
      <span
        style={{
          fontFamily: "Georgia",
          fontSize: fontSize * 0.82,
          lineHeight: 0.92,
        }}
      >
        €
      </span>
    </div>
  );
}
