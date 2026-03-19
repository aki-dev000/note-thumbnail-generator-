"use client";

import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { Template } from "@/lib/templates";

type Props = {
  title: string;
  tagline: string;
  photoUrl: string;
  template: Template;
};

export type ThumbnailCanvasHandle = {
  download: () => void;
};

const CANVAS_WIDTH = 1280;
const CANVAS_HEIGHT = 670;

const ThumbnailCanvas = forwardRef<ThumbnailCanvasHandle, Props>(
  ({ title, tagline, photoUrl, template }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useImperativeHandle(ref, () => ({
      download() {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const link = document.createElement("a");
        link.download = "note-thumbnail.png";
        link.href = canvas.toDataURL("image/png");
        link.click();
      },
    }));

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas || !photoUrl) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = photoUrl;

      img.onload = () => {
        // Draw photo (cover fit)
        const scale = Math.max(CANVAS_WIDTH / img.width, CANVAS_HEIGHT / img.height);
        const drawW = img.width * scale;
        const drawH = img.height * scale;
        const offsetX = (CANVAS_WIDTH - drawW) / 2;
        const offsetY = (CANVAS_HEIGHT - drawH) / 2;
        ctx.drawImage(img, offsetX, offsetY, drawW, drawH);

        // Overlay
        ctx.fillStyle = template.overlayColor;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // Title text
        const maxWidth = CANVAS_WIDTH - 120;
        ctx.fillStyle = template.textColor;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        if (template.textShadow) {
          ctx.shadowColor = "rgba(0,0,0,0.6)";
          ctx.shadowBlur = 12;
        }

        // Auto font size
        let fontSize = 80;
        ctx.font = `${template.fontWeight} ${fontSize}px 'Hiragino Sans', 'Yu Gothic', sans-serif`;
        while (ctx.measureText(title).width > maxWidth && fontSize > 32) {
          fontSize -= 4;
          ctx.font = `${template.fontWeight} ${fontSize}px 'Hiragino Sans', 'Yu Gothic', sans-serif`;
        }

        // Title (center vertically, slightly above center for tagline)
        const titleY = tagline ? CANVAS_HEIGHT / 2 - fontSize * 0.6 : CANVAS_HEIGHT / 2;
        ctx.fillText(title, CANVAS_WIDTH / 2, titleY, maxWidth);

        // Tagline
        if (tagline) {
          ctx.shadowBlur = 6;
          const tagFontSize = Math.min(fontSize * 0.42, 36);
          ctx.font = `normal ${tagFontSize}px 'Hiragino Sans', 'Yu Gothic', sans-serif`;
          ctx.globalAlpha = 0.85;
          ctx.fillText(tagline, CANVAS_WIDTH / 2, titleY + fontSize * 0.9, maxWidth);
          ctx.globalAlpha = 1;
        }

        ctx.shadowBlur = 0;
      };
    }, [title, tagline, photoUrl, template]);

    return (
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="w-full rounded-xl shadow-2xl"
        style={{ aspectRatio: "1280/670" }}
      />
    );
  }
);

ThumbnailCanvas.displayName = "ThumbnailCanvas";
export default ThumbnailCanvas;
