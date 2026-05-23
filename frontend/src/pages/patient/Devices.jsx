import { useState } from 'react';
import { useFetch, useAsync } from '@/hooks';
import { wearableService } from '@/services';
import { Cpu, Plus, Trash2, Wifi, WifiOff } from 'lucide-react';
import toast from 'react-hot-toast';

const DEVICE_TYPES = ['SMARTWATCH','OXIMETER','PRESSURE_MONITOR','ECG','GLUCOMETER','OTHER'];
const DEVICE_LABEL = {
  SMARTWATCH: 'Smartwatch', OXIMETER: 'Oxímetro', PRESSURE_MONITOR: 'Monitor de Pressão',
  ECG: 'ECG', GLUCOMETER: 'Glicosímetro', OTHER: 'Outro',
};
const STATUS_COLOR = {
  ACTIVE: 'text-green-600', INACTIVE: 'text-surface-400', SYNCING: 'text-amber-600', ERROR: 'text-red-600',
};

function AddDeviceModal({ onClose, onSaved }) {
  const [form, setForm]   = useState({ name: '', type: 'SMARTWATCH' });
  const { run, loading }  = useAsync(wearableService.addDevice);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    try {
      await run(form);
      toast.success('Dispositivo adicionado!');
      onSaved();
    } catch { toast.error('Erro ao adicionar'); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-900/30 backdrop-blur-sm">
      <div className="glass p-6 w-full max-w-sm animate-slide-up">
        <h3 className="font-display font-semibold text-lg mb-4">Novo Dispositivo</h3>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="label">Nome</label>
            <input className="input" value={form.name} onChange={set('name')} placeholder="Ex: Garmin Venu 3" required />
          </div>
          <div>
            <label className="label">Tipo</label>
            <select className="input" value={form.type} onChange={set('type')}>
              {DEVICE_TYPES.map((t) => <option key={t} value={t}>{DEVICE_LABEL[t]}</option>)}
            </select>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-ghost flex-1 justify-center">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">
              {loading ? 'Salvando…' : 'Adicionar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Devices() {
  const { data, loading, refetch } = useFetch(wearableService.listDevices);
  const { run: remove }            = useAsync(wearableService.removeDevice);
  const [showAdd, setShowAdd]      = useState(false);

  const handleRemove = async (id) => {
    if (!confirm('Remover dispositivo?')) return;
    try { await remove(id); toast.success('Removido'); refetch(); }
    catch { toast.error('Erro ao remover'); }
  };

  const devices = data || [];

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Dispositivos</h1>
          <p className="text-surface-500 text-sm mt-0.5">Wearables e sensores conectados</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary">
          <Plus size={15} /> Adicionar
        </button>
      </div>

      {loading && <p className="text-surface-400 text-sm text-center py-8">Carregando…</p>}

      {!loading && devices.length === 0 && (
        <div className="glass p-10 text-center text-surface-400 text-sm">
          <Cpu size={32} className="mx-auto mb-3 opacity-30" />
          Nenhum dispositivo registrado
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        {devices.map((d) => (
          <div key={d.id} className="glass p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
              <Cpu size={18} className="text-brand-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-surface-800 truncate">{d.name}</p>
              <p className="text-xs text-surface-500">{DEVICE_LABEL[d.type]}</p>
              <div className="flex items-center gap-1 mt-0.5">
                {d.status === 'ACTIVE'
                  ? <Wifi size={11} className="text-green-600" />
                  : <WifiOff size={11} className="text-surface-300" />}
                <span className={`text-[10px] ${STATUS_COLOR[d.status]}`}>{d.status}</span>
              </div>
            </div>
            <button onClick={() => handleRemove(d.id)} className="btn-ghost p-1.5 text-red-600 hover:text-red-600 shrink-0">
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>

      {showAdd && <AddDeviceModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); refetch(); }} />}
    </div>
  );
}
