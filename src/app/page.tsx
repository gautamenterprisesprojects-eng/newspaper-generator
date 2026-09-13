import { Suspense } from "react";
import { EditorCanvasLoader } from "@/components/editor/EditorCanvasLoader";
import { PortalLaunchBootstrap } from "@/components/editor/PortalLaunchBootstrap";
import { PortalAccessGate } from "@/components/editor/PortalAccessGate";
import { NmsHeadlessExportBridge } from "@/components/editor/NmsHeadlessExportBridge";

export default function Home() {
  return (
    <Suspense fallback={null}>
      <PortalAccessGate>
        <PortalLaunchBootstrap />
        <NmsHeadlessExportBridge />
        <EditorCanvasLoader />
      </PortalAccessGate>
    </Suspense>
  );
}
