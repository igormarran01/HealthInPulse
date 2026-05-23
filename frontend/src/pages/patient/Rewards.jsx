import { useState } from 'react';
import { useFetch, useAsync } from '@/hooks';
import { useAuth } from '@/contexts/AuthContext';
import { rewardService, coinService } from '@/services';
import { Gift, Coins, CheckCircle2, Clock, Stethoscope, Percent, FileText, Package, Heart } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';

const TYPE_ICON = {
  consultation: Stethoscope,
  discount:     Percent,
  exam:         Heart,
  item:         Package,
};

const STATUS_META = {
  PENDING:  { label: 'Em análise',  color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200' },
  APPROVED: { label: 'Aprovado',    color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200' },
  DENIED:   { label: 'Negado',      color: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200'   },
};

function RewardCard({ reward, balance, onRedeem, loading }) {
  const Icon = TYPE_ICON[reward.type] || Package;
  const canAfford = balance >= reward.costCoins;
  return (
    <div className="glass card-hover p-5 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="w-11 h-11 rounded-xl bg-brand-50 flex items-center justify-center text-brand-700">
          <Icon size={18} />
        </div>
        <span className="inline-flex items-center gap-1 text-sm font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
          <Coins size={13} /> {reward.costCoins}
        </span>
      </div>
      <h3 className="font-display font-semibold text-surface-900 leading-tight">{reward.title}</h3>
      {reward.description && (
        <p className="text-xs text-surface-500 mt-1.5 flex-1">{reward.description}</p>
      )}
      <button
        onClick={() => onRedeem(reward)}
        disabled={!canAfford || loading}
        className={`mt-4 w-full py-2 rounded-xl text-sm font-medium transition-all ${
          canAfford
            ? 'bg-brand-700 hover:bg-brand-800 text-white'
            : 'bg-surface-100 text-surface-400 cursor-not-allowed'
        }`}
      >
        {canAfford ? 'Resgatar' : `Faltam ${reward.costCoins - balance} coins`}
      </button>
    </div>
  );
}

export default function PatientRewards() {
  const { user, refreshCoins } = useAuth();
  const { data: rewards, loading: lr }                  = useFetch(rewardService.list);
  const { data: redemptions, loading: lh, refetch: rH } = useFetch(rewardService.myRedemptions);
  const { run: redeemAction, loading: redeeming } = useAsync(rewardService.redeem);

  const [tab, setTab] = useState('store'); // store | history

  const balance = user?.healthCoins ?? 0;

  const onRedeem = async (reward) => {
    if (!confirm(`Resgatar "${reward.title}" por ${reward.costCoins} coins?`)) return;
    try {
      await redeemAction(reward.id);
      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.5 },
        colors: ['#003F7E', '#00A0DC', '#fbbf24'],
      });
      toast.success('Resgate confirmado!');
      refreshCoins();
      rH();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Não foi possível resgatar');
    }
  };

  const items = rewards || [];
  const myReds = redemptions || [];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="glass p-6 flex flex-col md:flex-row items-start md:items-center gap-6 bg-gradient-to-br from-white to-amber-50/40">
        <div className="flex-1">
          <p className="text-xs uppercase tracking-widest text-surface-400 font-medium">Loja Care Plus</p>
          <h1 className="font-display text-2xl md:text-3xl font-bold mt-1 flex items-center gap-3">
            <Gift size={26} className="text-brand-700" />
            Recompensas
          </h1>
          <p className="text-sm text-surface-500 mt-2 max-w-xl">
            Troque seus health-coins por benefícios reais. Coins são ganhos ao completar metas,
            triagens e manter consistência no uso da pulseira.
          </p>
        </div>
        <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-amber-50 border border-amber-200">
          <Coins size={22} className="text-amber-600" />
          <div>
            <p className="font-display font-bold text-2xl text-amber-700 leading-none">{balance}</p>
            <p className="text-[10px] text-amber-700/70 uppercase tracking-wider mt-1">seu saldo</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-surface-200">
        <button
          onClick={() => setTab('store')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'store' ? 'border-brand-700 text-brand-700' : 'border-transparent text-surface-500 hover:text-surface-700'
          }`}
        >
          Catálogo
        </button>
        <button
          onClick={() => setTab('history')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'history' ? 'border-brand-700 text-brand-700' : 'border-transparent text-surface-500 hover:text-surface-700'
          }`}
        >
          Meus resgates {myReds.length > 0 && <span className="ml-1 text-xs text-surface-400">({myReds.length})</span>}
        </button>
      </div>

      {/* Conteúdo */}
      {tab === 'store' && (
        lr ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[...Array(6)].map((_, i) => <div key={i} className="glass h-52 animate-pulse bg-surface-100" />)}
          </div>
        ) : items.length === 0 ? (
          <div className="glass p-8 text-center text-surface-400">
            <Gift size={28} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nenhuma recompensa disponível no momento</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {items.map((r) => (
              <RewardCard
                key={r.id}
                reward={r}
                balance={balance}
                onRedeem={onRedeem}
                loading={redeeming}
              />
            ))}
          </div>
        )
      )}

      {tab === 'history' && (
        lh ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => <div key={i} className="glass h-16 animate-pulse bg-surface-100" />)}
          </div>
        ) : myReds.length === 0 ? (
          <div className="glass p-8 text-center text-surface-400">
            <Clock size={28} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">Você ainda não resgatou nenhuma recompensa</p>
          </div>
        ) : (
          <div className="space-y-2">
            {myReds.map((red) => {
              const meta = STATUS_META[red.status] || STATUS_META.PENDING;
              const Icon = TYPE_ICON[red.reward?.type] || Package;
              return (
                <div key={red.id} className="glass p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center text-brand-700 shrink-0">
                    <Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-surface-800 truncate">{red.reward?.title}</p>
                    <p className="text-xs text-surface-500">
                      {format(new Date(red.redeemedAt), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700">
                    <Coins size={11} /> -{red.costCoins}
                  </span>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${meta.bg} ${meta.color} ${meta.border}`}>
                    {meta.label}
                  </span>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
