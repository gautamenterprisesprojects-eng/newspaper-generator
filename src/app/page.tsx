import { Suspense } from "react";
import { EditorCanvasLoader } from "@/components/editor/EditorCanvasLoader";
import { PortalLaunchBootstrap } from "@/components/editor/PortalLaunchBootstrap";

export default function Home() {
  return (
    <>
      <Suspense fallback={null}>
        <PortalLaunchBootstrap />
      </Suspense>
      <EditorCanvasLoader />
    </>
  );
}
