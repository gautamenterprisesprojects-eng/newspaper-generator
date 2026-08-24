import { Suspense } from "react";
import { EditorCanvasLoader } from "@/components/editor/EditorCanvasLoader";
import { PortalLaunchBootstrap } from "@/components/editor/PortalLaunchBootstrap";
import { PortalAccessGate } from "@/components/editor/PortalAccessGate";

export default function Home() {
  return (
    <Suspense fallback={null}>
      <PortalAccessGate>
        <PortalLaunchBootstrap />
        <EditorCanvasLoader />
      </PortalAccessGate>
    </Suspense>
  );
}
