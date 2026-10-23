import { loadAcademyCatalog } from "../integrations/owl-academy/catalog";
import { ExplorerDashboard } from "../ui/ExplorerDashboard";

export default async function Home() {
  return <ExplorerDashboard tomes={await loadAcademyCatalog()} />;
}
