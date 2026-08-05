"use client";

import { useEffect, useRef } from "react";
import type { LandmarkSet } from "../../src/domain";
import { getContainedPreviewGeometry, mapNormalizedPreviewPoint } from "./preview-geometry";

const CONNECTIONS: Array<[keyof LandmarkSet, keyof LandmarkSet]> = [
  ["leftShoulder", "rightShoulder"],
  ["leftShoulder", "leftElbow"],
  ["leftElbow", "leftWrist"],
  ["rightShoulder", "rightElbow"],
  ["rightElbow", "rightWrist"],
  ["leftShoulder", "leftHip"],
  ["rightShoulder", "rightHip"],
  ["leftHip", "rightHip"],
  ["leftHip", "leftKnee"],
  ["leftKnee", "leftAnkle"],
  ["rightHip", "rightKnee"],
  ["rightKnee", "rightAnkle"],
];

export function PoseCanvas({
  landmarks,
  mirrored,
  sourceWidth,
  sourceHeight,
}: {
  landmarks: LandmarkSet | null;
  mirrored: boolean;
  sourceWidth: number;
  sourceHeight: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const landmarksRef = useRef(landmarks);
  const mirroredRef = useRef(mirrored);
  const sourceWidthRef = useRef(sourceWidth);
  const sourceHeightRef = useRef(sourceHeight);
  const redrawRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    landmarksRef.current = landmarks;
    mirroredRef.current = mirrored;
    sourceWidthRef.current = sourceWidth;
    sourceHeightRef.current = sourceHeight;
    redrawRef.current?.();
  }, [landmarks, mirrored, sourceHeight, sourceWidth]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const redraw = () => {
      const rect = parent.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      const context = canvas.getContext("2d");
      if (!context) return;
      context.scale(dpr, dpr);
      context.clearRect(0, 0, rect.width, rect.height);
      const landmarks = landmarksRef.current;
      if (!landmarks) return;
      const width = sourceWidthRef.current > 0 ? sourceWidthRef.current : rect.width;
      const height = sourceHeightRef.current > 0 ? sourceHeightRef.current : rect.height;
      const geometry = getContainedPreviewGeometry(rect.width, rect.height, width, height);
      const point = (name: keyof LandmarkSet) => {
        const landmark = landmarks[name];
        if (Math.min(landmark.visibility, landmark.presence) < 0.45) return null;
        return mapNormalizedPreviewPoint(landmark.x, landmark.y, geometry, mirroredRef.current);
      };
      context.lineWidth = 2;
      context.lineCap = "round";
      context.strokeStyle = "rgba(164, 231, 191, 0.9)";
      for (const [a, b] of CONNECTIONS) {
        const start = point(a);
        const end = point(b);
        if (!start || !end) continue;
        context.beginPath();
        context.moveTo(start.x, start.y);
        context.lineTo(end.x, end.y);
        context.stroke();
      }
      for (const name of Object.keys(landmarks) as Array<keyof LandmarkSet>) {
        const position = point(name);
        if (!position) continue;
        context.fillStyle =
          name.includes("Shoulder") || name.includes("Hip") ? "#f4b58c" : "#dcefe4";
        context.beginPath();
        context.arc(position.x, position.y, 3.2, 0, Math.PI * 2);
        context.fill();
      }
    };
    redrawRef.current = redraw;
    redraw();
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(redraw);
      observer.observe(parent);
      return () => {
        observer.disconnect();
        if (redrawRef.current === redraw) redrawRef.current = null;
      };
    }
    window.addEventListener("resize", redraw);
    return () => {
      window.removeEventListener("resize", redraw);
      if (redrawRef.current === redraw) redrawRef.current = null;
    };
  }, []);

  return <canvas ref={canvasRef} className="preview-canvas" aria-hidden="true" />;
}
