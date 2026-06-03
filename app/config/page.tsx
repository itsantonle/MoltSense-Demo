import { ConfigPage } from '@/components/config/config-page';

export const metadata = {
  title: 'Config - MoltSense',
  description: 'Configure farm-wide and per-device ESP32 thresholds',
};

export default function Page() {
  return <ConfigPage />;
}
