import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, AlertCircle, Check, ChevronDown, CircleHelp, LoaderCircle, X } from 'lucide-react';

const ToastContext = createContext(() => {});
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((message, kind = 'success') => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((current) => [...current, { id, message, kind }]);
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 4200);
  }, []);
  const value = useMemo(() => push, [push]);
  return <ToastContext.Provider value={value}>{children}<div className="toast-stack" aria-live="polite" aria-atomic="false">{toasts.map((toast) => <div key={toast.id} className={`toast toast-${toast.kind}`} role={toast.kind === 'error' ? 'alert' : 'status'}>{toast.kind === 'error' ? <AlertCircle size={17} /> : <Check size={17} />}<span>{toast.message}</span><button aria-label="Dismiss notification" onClick={() => setToasts((items) => items.filter((item) => item.id !== toast.id))}><X size={15} /></button></div>)}</div></ToastContext.Provider>;
}
export const useToast = () => useContext(ToastContext);

export function Logo({ inverse = false, compact = false }) {
  return <span className={`brand-lockup ${inverse ? 'brand-inverse' : ''} ${compact ? 'brand-compact' : ''}`}><span className="brand-mark" aria-hidden="true"><span /></span><span className="brand-copy"><strong>Bloodline</strong><small>DONATION NETWORK</small></span></span>;
}

export function Button({ children, variant = 'primary', className = '', type = 'button', disabled, onClick, icon: Icon, ...props }) {
  return <button type={type} className={`key-button key-${variant} ${className}`} disabled={disabled} onClick={onClick} {...props}>{Icon && <Icon size={17} strokeWidth={2} />}{children}</button>;
}
export function LinkButton({ children, variant = 'primary', className = '', icon: Icon, ...props }) {
  return <a className={`key-button key-${variant} ${className}`} {...props}>{Icon && <Icon size={17} strokeWidth={2} />}{children}</a>;
}
export function SectionLabel({ children, number, className = '' }) { return <div className={`section-label ${className}`}>{number && <span>{number}</span>}<span>{children}</span></div>; }
export function Panel({ children, className = '', ...props }) { return <section className={`panel ${className}`} {...props}>{children}</section>; }
export function PageHeading({ eyebrow, title, description, action }) { return <div className="page-heading"><div>{eyebrow && <SectionLabel>{eyebrow}</SectionLabel>}<h1>{title}</h1>{description && <p>{description}</p>}</div>{action && <div className="page-heading-action">{action}</div>}</div>; }
export function MetricCard({ label, value, detail, icon: Icon = Activity, tone = 'default' }) { return <Panel className={`metric-card metric-${tone}`}><div className="metric-top"><span className="mono-label">{label}</span><span className="metric-icon"><Icon size={18} /></span></div><strong className="metric-value">{value ?? '—'}</strong>{detail && <span className="metric-detail">{detail}</span>}</Panel>; }
export function StatusBadge({ status }) {
  const key = String(status || 'Unknown').toLowerCase().replaceAll('_', '-');
  return <span className={`status-badge status-${key}`}><i />{String(status || 'Unknown').replaceAll('_', ' ')}</span>;
}
export function BloodBadge({ group }) { return <span className="blood-badge">{group || '—'}</span>; }
export function LoadingState({ label = 'Loading records' }) { return <div className="state-panel" role="status"><LoaderCircle className="spin" size={22} /><span>{label}…</span></div>; }
export function ErrorState({ error, onRetry }) { return <div className="state-panel state-error" role="alert"><AlertCircle size={22} /><div><strong>We could not load this view.</strong><p>{error || 'Please try again.'}</p>{onRetry && <Button variant="secondary" onClick={onRetry}>Try again</Button>}</div></div>; }
export function EmptyState({ title, description, action }) { return <div className="empty-state"><span className="empty-icon"><CircleHelp size={20} /></span><h3>{title}</h3><p>{description}</p>{action}</div>; }
export function DataTable({ columns, rows = [], rowKey = 'id', emptyTitle = 'No records yet', emptyDescription = 'There are no records to show here.' }) {
  if (!rows.length) return <EmptyState title={emptyTitle} description={emptyDescription} />;
  return <div className="table-scroll"><table className="data-table"><thead><tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={row[rowKey] ?? index}>{columns.map((column) => <td key={column.key}>{column.render ? column.render(row) : row[column.key] ?? '—'}</td>)}</tr>)}</tbody></table></div>;
}
export function Field({ label, hint, error, className = '', id, children, ...props }) {
  return (
    <label className={`form-field ${className}`} htmlFor={id}>
      <span>{label}{props.required && <b aria-hidden="true"> *</b>}</span>
      {children || <input id={id} {...props} />}
      {hint && <small className="field-hint">{hint}</small>}
      {error && <small className="field-error">{error}</small>}
    </label>
  );
}
export function SelectField({ label, hint, children, className = '', id, ...props }) {
  return (
    <label className={`form-field ${className}`} htmlFor={id}>
      <span>{label}{props.required && <b aria-hidden="true"> *</b>}</span>
      <div className="select-wrap">
        <select id={id} {...props}>{children}</select>
        <ChevronDown size={16} aria-hidden="true" />
      </div>
      {hint && <small className="field-hint">{hint}</small>}
    </label>
  );
}
export function Modal({ title, children, onClose }) {
  const dialogRef=useRef(null);
  useEffect(()=>{const prior=document.activeElement;const dialog=dialogRef.current;const close=dialog?.querySelector('button');close?.focus();const onKey=(event)=>{if(event.key==='Escape'){onClose();return;}if(event.key==='Tab'&&dialog){const items=[...dialog.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled])')];if(!items.length)return;const first=items[0],last=items[items.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}};document.addEventListener('keydown',onKey);return()=>{document.removeEventListener('keydown',onKey);prior?.focus?.();};},[onClose]);
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section ref={dialogRef} className="modal panel" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-head"><div><SectionLabel>CONTROL PANEL</SectionLabel><h2 id="modal-title">{title}</h2></div><button className="icon-key" aria-label="Close dialog" onClick={onClose}><X size={18} /></button></div>{children}</section></div>;
}
