"use client";

import "regenerator-runtime/runtime";
import dynamic from "next/dynamic";

const EditorCanvas = dynamic(
  () => import("@/components/editor/EditorCanvas").then((mod) => mod.EditorCanvas),
  {
    ssr: false,
    loading: () => <main className="editor-shell" />,
  },
);

export function EditorCanvasLoader() {
  return <EditorCanvas />;
}
