import React, { useRef } from 'react';

interface ReferencePanelProps {
  referenceText: string;
  onReferenceTextChange: (next: string) => void;
  referenceImageDataUrl: string | null;
  onReferenceImageDataUrlChange: (next: string | null) => void;
}

export const ReferencePanel: React.FC<ReferencePanelProps> = ({
  referenceText,
  onReferenceTextChange,
  referenceImageDataUrl,
  onReferenceImageDataUrlChange,
}) => {
  const referenceImageInputRef = useRef<HTMLInputElement>(null);

  const handleReferenceImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onReferenceImageDataUrlChange(reader.result);
      }
    };
    reader.onerror = () => {
      console.error('Error al cargar imagen de referencia');
      window.alert('No se pudo cargar la imagen de referencia.');
    };

    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const hasReferenceImage = Boolean(referenceImageDataUrl);

  return (
    <aside
      aria-labelledby="reference-panel-title"
      className="bg-white/50 dark:bg-[#1a1c23]/40 rounded-3xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.04)] border border-white/60 dark:border-white/5 backdrop-blur-xl flex flex-col gap-4 min-h-[70vh]"
    >
      <h2 id="reference-panel-title" className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
        Panel de Referencia
      </h2>
      <p id="reference-panel-help" className="text-sm text-slate-500 dark:text-slate-300">
        Usa este espacio para comparar tu borrador con texto o imagenes de apoyo.
      </p>
      <textarea
        value={referenceText}
        onChange={(event) => onReferenceTextChange(event.target.value)}
        className="w-full min-h-56 bg-white/40 dark:bg-black/20 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 p-4 resize-y outline-none focus:border-indigo-500/50 text-sm text-slate-700 dark:text-slate-200"
        placeholder="Pega aquí un texto de referencia para compararlo mientras escribes..."
        aria-label="Texto de referencia"
        aria-describedby="reference-panel-help"
      />

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => referenceImageInputRef.current?.click()}
          className="rounded-lg px-3 py-1.5 text-sm font-medium bg-indigo-500/20 text-indigo-700 hover:bg-indigo-500/30 transition-colors dark:bg-indigo-500/30 dark:text-indigo-200"
          title="Cargar imagen de referencia"
          aria-label="Cargar imagen de referencia"
        >
          Cargar imagen
        </button>
        <button
          type="button"
          onClick={() => onReferenceImageDataUrlChange(null)}
          disabled={!hasReferenceImage}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors dark:bg-black/20 dark:text-slate-200 ${
            hasReferenceImage
              ? 'bg-white/50 text-slate-700 hover:bg-white/70 dark:hover:bg-black/30'
              : 'bg-white/30 text-slate-400 cursor-not-allowed dark:text-slate-500'
          }`}
          title="Limpiar imagen de referencia"
          aria-label="Limpiar imagen de referencia"
        >
          Limpiar imagen
        </button>
      </div>

      <input
        ref={referenceImageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleReferenceImageChange}
        tabIndex={-1}
        aria-hidden="true"
      />

      {referenceImageDataUrl ? (
        <img
          src={referenceImageDataUrl}
          alt="Referencia visual"
          className="w-full rounded-2xl border border-slate-200/50 dark:border-slate-700/50 object-contain max-h-[360px] bg-white/30 dark:bg-black/20"
        />
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300/70 dark:border-slate-700/60 p-6 text-sm text-slate-500 text-center">
          Puedes cargar una imagen local para usarla como referencia visual.
        </div>
      )}
    </aside>
  );
};
