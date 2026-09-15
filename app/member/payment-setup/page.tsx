import Link from 'next/link';

export const metadata = { title: 'Payment Setup | CurrentPulse' };

export default function PaymentSetupPage() {
  return <main className="min-h-screen bg-[#07111f] px-5 py-14 text-white">
    <div className="mx-auto max-w-3xl">
      <div className="text-xs font-black uppercase tracking-[.18em] text-amber-300">CurrentPulse Payments</div>
      <h1 className="mt-3 text-4xl font-black">Payments are being activated</h1>
      <p className="mt-5 leading-8 text-slate-300">Your CurrentPulse account, products, orders and entitlements are ready. Real-money checkout stays disabled until a verified payment-provider merchant account is connected securely.</p>
      <div className="mt-8 rounded-2xl border border-emerald-400/25 bg-slate-900 p-6">
        <h2 className="text-xl font-black text-emerald-300">What works now</h2>
        <p className="mt-3 leading-7 text-slate-400">Students can create an account and use the member area. CurrentPulse can show products and maintain account history. No student receives paid access unless the server verifies a genuine provider payment.</p>
      </div>
      <div className="mt-5 rounded-2xl border border-amber-300/25 bg-slate-900 p-6">
        <h2 className="text-xl font-black text-amber-300">Why checkout is not faked</h2>
        <p className="mt-3 leading-7 text-slate-400">A simulated production payment would create a security hole. Development and CI therefore test the payment contract without granting free production entitlements. Provider TEST checkout will be used after merchant onboarding.</p>
      </div>
      <div className="mt-8 flex flex-wrap gap-3"><Link href="/member" className="rounded-xl bg-emerald-300 px-5 py-3 font-black text-slate-950">Member Dashboard</Link><Link href="/member/shop" className="rounded-xl border border-slate-600 px-5 py-3 font-black">View Products</Link></div>
    </div>
  </main>;
}
