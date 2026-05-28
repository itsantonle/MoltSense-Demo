import { HubsPage } from '@/components/hub-management/hubs-page';
import { Navbar } from '@/components/shared/navbar';

export const metadata = {
  title: 'Hub Management - MoltSense',
  description: 'Monitor and manage your hub controllers',
};

export default function Page() {
  return (
    <>
      <Navbar />
      <HubsPage />
    </>
  );
}
