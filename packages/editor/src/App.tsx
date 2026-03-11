import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
} from "react-resizable-panels";
import { Toolbar } from "./components/Toolbar";
import { StageView } from "./components/StageView";
import { StagePreview } from "./components/StagePreview";
import { Inspector } from "./components/Inspector";
import { Timeline } from "./components/Timeline";

export function App(): React.JSX.Element {
  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <Toolbar />

      <PanelGroup direction="vertical" className="flex-1">
        {/* Top row: three columns */}
        <Panel defaultSize={70} minSize={30}>
          <PanelGroup direction="horizontal">
            {/* Left — Stage View */}
            <Panel defaultSize={20} minSize={12} maxSize={35}>
              <StageView />
            </Panel>

            <PanelResizeHandle className="w-px" />

            {/* Center — Player preview */}
            <Panel defaultSize={55} minSize={30}>
              <StagePreview />
            </Panel>

            <PanelResizeHandle className="w-px" />

            {/* Right — Inspector */}
            <Panel defaultSize={25} minSize={12} maxSize={35}>
              <Inspector />
            </Panel>
          </PanelGroup>
        </Panel>

        <PanelResizeHandle className="h-px" />

        {/* Bottom — Timeline */}
        <Panel defaultSize={30} minSize={15} maxSize={50}>
          <Timeline />
        </Panel>
      </PanelGroup>
    </div>
  );
}
