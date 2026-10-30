import React, { useRef, useEffect } from "react";

// Code 39 character encoding (narrow=1, wide=3, bars and spaces alternate starting with bar)
const CODE39_MAP = {
  "0":"nnnwwnwnn","1":"wnnwnnnnw","2":"nnwwnnnnw","3":"wnwwnnnn","4":"nnnwwnnnw",
  "5":"wnnwwnnn","6":"nnwwwnnn","7":"nnnwnnwnw","8":"wnnwnnwn","9":"nnwwnnwn",
  "A":"wnnnnwnnw","B":"nnwnnwnnw","C":"wnwnnwnn","D":"nnnnwwnnw","E":"wnnnwwnn",
  "F":"nnwnwwnn","G":"nnnnnwwnw","H":"wnnnnwwn","I":"nnwnnwwn","J":"nnnnwwwn",
  "K":"wnnnnnnww","L":"nnwnnnnww","M":"wnwnnnnw","N":"nnnnwnnww","O":"wnnnwnnw",
  "P":"nnwnwnnw","Q":"nnnnnnwww","R":"wnnnnnww","S":"nnwnnnww","T":"nnnnwnww",
  "U":"wwnnnnnnw","V":"nwwnnnnnw","W":"wwwnnnnn","X":"nwnnwnnnw","Y":"wwnnwnnn",
  "Z":"nwwnwnnn","-":"nwnnnnwnw"," ":"nwwnnnwn","*":"nwnnwnwn",".":"wwnnnnwn",
  "$":"nwnwnwnn","/":"nwnwnnnw","+":"nwnnnwnw","%":"nnnwnwnw"
};

function encodeCode39(text) {
  const chars = ["*", ...text.toUpperCase().split(""), "*"];
  const patterns = [];
  chars.forEach((ch, idx) => {
    const pattern = CODE39_MAP[ch];
    if (pattern) {
      for (let i = 0; i < pattern.length; i++) {
        const isBar = i % 2 === 0;
        const isWide = pattern[i] === "w";
        patterns.push({ bar: isBar, wide: isWide });
      }
      if (idx < chars.length - 1) patterns.push({ bar: false, wide: false }); // inter-character gap
    }
  });
  return patterns;
}

export default function Barcode39({ value, width = 280, height = 70 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !value) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 2;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    ctx.scale(dpr, dpr);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    const patterns = encodeCode39(value);
    const narrowWidth = 1;
    const wideWidth = 2.5;
    let totalWidth = 0;
    patterns.forEach(p => { totalWidth += p.wide ? wideWidth : narrowWidth; });

    const scale = Math.min((width - 20) / totalWidth, 3);
    let x = (width - totalWidth * scale) / 2;

    patterns.forEach(p => {
      const w = (p.wide ? wideWidth : narrowWidth) * scale;
      if (p.bar) {
        ctx.fillStyle = "#000000";
        ctx.fillRect(x, 4, w, height - 8);
      }
      x += w;
    });
  }, [value, width, height]);

  return <canvas ref={canvasRef} style={{ display: "block", margin: "0 auto", borderRadius: "4px" }} />;
}