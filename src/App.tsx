import { TabsProvider, useTabs } from "./context/TabsContext";
import TabBar from "./components/TabBar";
import AddressBar from "./components/AddressBar";

function Browser() {
  const { activeTab } = useTabs();

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-neutral-950 text-neutral-100">
      <TabBar />
      <AddressBar />
      <div className="relative min-h-0 flex-1 bg-white">
        {!activeTab?.url && (
          <div className="flex h-full flex-col items-center justify-center gap-2 bg-neutral-950 text-neutral-500">
            <h1 className="text-4xl font-bold tracking-tight">DevBrowser</h1>
            <p className="text-sm">
              Escribe una URL en la barra de direcciones para navegar
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function App() {
  return (
    <TabsProvider>
      <Browser />
    </TabsProvider>
  );
}

export default App;
