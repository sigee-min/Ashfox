import { redirect } from 'next/navigation';
import { withBasePath } from '@/lib/site';

export default function RootPage() {
  redirect(withBasePath('/en'));
}
