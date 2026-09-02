import Home from '@/app/page';

export const metadata = {
  title: 'ClearPath Studio — Accessibility planning canvas',
  description:
    'Audit, compare, and improve shared floor plans with human approval at every step.',
};

export default function StudioPage() {
  return <Home showLanding={false} />;
}
