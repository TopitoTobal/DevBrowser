import { TabsProvider } from "./context/TabsContext";
import TabBar from "./components/TabBar";
import AddressBar from "./components/AddressBar";
import BrowserView from "./components/BrowserView";

function App() {
  return (
    <TabsProvider>
      <div className="flex h-screen w-screen flex-col overflow-hidden bg-neutral-950 text-neutral-100">
        <TabBar />
        <AddressBar />
        <BrowserView />
      </div>
    </TabsProvider>
  );
}

export default App;
