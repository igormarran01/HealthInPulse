import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useFetch, useAsync } from '@/hooks';
import { examService } from '@/services';
import { Upload, FileText, Trash2, Eye, Clock, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import toast from 'react-hot-toast';
import clsx from 'clsx';

const STATUS_META = {
  PENDING:    { label: 'Aguardando',    icon: Clock,        color: 'text-surface-500' },
  PROCESSING: { label: 'Processando',   icon: Loader,       color: 'text-amber-600 animate-spin' },
  DONE:       { label: 'Concluído',     icon: CheckCircle,  color: 'text-green-600' },
  ERROR:      { label: 'Erro',          icon: AlertCircle,  color: 'text-red-600' },
};

const RISK_CLASS = { LOW: 'badge-low', MODERATE: 'badge-moderate', HIGH: 'badge-high', CRITICAL: 'badge-critical' };
const RISK_LABEL = { LOW: 'Baixo', MODERATE: 'Moderado', HIGH: 'Alto', CRITICAL: 'Crítico' };

function UploadZone({ onUploaded }) {
  const [file,  setFile]  = useState(null);
  const [title, setTitle] = useState('');
  const [desc,  setDesc]  = useState('');
  const { run, loading }  = useAsync(examService.upload);

  const onDrop = useCallback((accepted) => {
    if (accepted[0]) { setFile(accepted[0]); setTitle(accepted[0].name.replace(/\.[^.]+$/, '')); }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'application/pdf': [], 'image/*': [] }, maxFiles: 1,
  });

  const submit = async (e) => {
    e.preventDefault();
    if (!file || !title) return toast.error('Selecione um arquivo e informe o título');
    try {
      await run(file, { title, description: desc });
      toast.success('Exame enviado! O processamento pode levar alguns instantes.');
      setFile(null); setTitle(''); setDesc('');
      onUploaded();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao enviar');
    }
  };

  return (
    <form onSubmit={submit} className="glass p-5 space-y-4">
      <h3 className="font-display font-semibold">Enviar novo exame</h3>

      <div
        {...getRootProps()}
        className={clsx(
          'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all',
          isDragActive ? 'border-brand-500 bg-brand-50' : 'border-surface-200 hover:border-surface-300',
        )}
      >
        <input {...getInputProps()} />
        <Upload size={24} className="mx-auto text-surface-400 mb-2" />
        {file ? (
          <p className="text-sm text-brand-600">{file.name}</p>
        ) : (
          <p className="text-sm text-surface-400">Arraste um PDF ou imagem aqui<br />ou clique para selecionar</p>
        )}
      </div>

      {file && (
        <>
          <div>
            <label className="label">Título</label>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Hemograma completo" />
          </div>
          <div>
            <label className="label">Descrição (opcional)</label>
            <input className="input" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Observações…" />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
            {loading ? 'Enviando…' : 'Enviar exame'}
          </button>
        </>
      )}
    </form>
  );
}

export default function PatientExams() {
  const { data, loading, refetch } = useFetch(() => examService.list({ limit: 20 }));
  const { run: remove } = useAsync(examService.remove);

  const handleRemove = async (id) => {
    if (!confirm('Remover este exame?')) return;
    try { await remove(id); toast.success('Exame removido'); refetch(); }
    catch { toast.error('Erro ao remover'); }
  };

  const exams = data?.items || [];

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-bold">Exames</h1>
        <p className="text-surface-500 text-sm mt-0.5">Envie e acompanhe seus exames</p>
      </div>

      <UploadZone onUploaded={refetch} />

      <div className="space-y-2">
        {loading && <div className="text-surface-400 text-sm text-center py-8">Carregando…</div>}
        {!loading && exams.length === 0 && (
          <div className="glass p-8 text-center text-surface-400 text-sm">
            <FileText size={28} className="mx-auto mb-2 opacity-30" />
            Nenhum exame enviado ainda
          </div>
        )}
        {exams.map((exam) => {
          const meta = STATUS_META[exam.status];
          const Icon = meta.icon;
          return (
            <div key={exam.id} className="glass p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
                <FileText size={18} className="text-brand-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-surface-800 truncate">{exam.title}</p>
                <p className="text-xs text-surface-500">
                  {format(new Date(exam.uploadedAt), "dd MMM yyyy", { locale: ptBR })}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {exam.examResult?.riskLevel && (
                  <span className={RISK_CLASS[exam.examResult.riskLevel]}>
                    {RISK_LABEL[exam.examResult.riskLevel]}
                  </span>
                )}
                <div className="flex items-center gap-1 text-xs">
                  <Icon size={13} className={meta.color} />
                  <span className="text-surface-500">{meta.label}</span>
                </div>
                <button onClick={() => handleRemove(exam.id)} className="btn-ghost p-1.5 text-red-500 hover:text-red-600">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
