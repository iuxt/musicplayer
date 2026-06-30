import { X } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";

interface PlaylistNameDialogProps {
  title: string;
  initialName?: string;
  submitLabel: string;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (name: string) => void;
}

export function PlaylistNameDialog({
  title,
  initialName = "",
  submitLabel,
  busy,
  error,
  onCancel,
  onSubmit
}: PlaylistNameDialogProps) {
  const [name, setName] = useState(initialName);
  const validationError = useMemo(() => (name.trim() ? null : "名称不能为空"), [name]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (validationError) {
      return;
    }

    onSubmit(name.trim());
  };

  return (
    <div className="modal-layer" role="presentation">
      <form className="metadata-dialog" role="dialog" aria-modal="true" aria-label={title} onSubmit={submit}>
        <div className="metadata-dialog-heading">
          <h2>{title}</h2>
          <button type="button" aria-label={`关闭${title}`} onClick={onCancel} disabled={busy}>
            <X size={16} />
          </button>
        </div>
        <label>
          名称
          <input value={name} onChange={(event) => setName(event.target.value)} disabled={busy} autoFocus />
        </label>
        {validationError || error ? <p className="metadata-dialog-error">{validationError ?? error}</p> : null}
        <div className="metadata-dialog-actions">
          <button type="button" onClick={onCancel} disabled={busy}>
            取消
          </button>
          <button type="submit" disabled={busy || Boolean(validationError)}>
            {submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
