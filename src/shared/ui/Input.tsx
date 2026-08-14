import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import "./Input.css";

type FieldProps = {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
  htmlFor: string;
};

export function Field({ label, error, hint, children, htmlFor }: FieldProps) {
  return (
    <div className="ws-field">
      <label className="ws-field__label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint ? <p className="ws-field__hint">{hint}</p> : null}
      {error ? (
        <p className="ws-field__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type InputProps = {
  label: string;
  error?: string;
  hint?: string;
} & InputHTMLAttributes<HTMLInputElement>;

export function Input({ label, error, hint, id, className = "", ...rest }: InputProps) {
  const fieldId = id ?? rest.name ?? label;
  return (
    <Field label={label} error={error} hint={hint} htmlFor={fieldId}>
      <input
        id={fieldId}
        className={`ws-input ${className}`.trim()}
        aria-invalid={error ? true : undefined}
        {...rest}
      />
    </Field>
  );
}

type TextareaProps = {
  label: string;
  error?: string;
  hint?: string;
} & TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Textarea({
  label,
  error,
  hint,
  id,
  className = "",
  ...rest
}: TextareaProps) {
  const fieldId = id ?? rest.name ?? label;
  return (
    <Field label={label} error={error} hint={hint} htmlFor={fieldId}>
      <textarea
        id={fieldId}
        className={`ws-input ws-input--textarea ${className}`.trim()}
        aria-invalid={error ? true : undefined}
        {...rest}
      />
    </Field>
  );
}

type SelectProps = {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
} & SelectHTMLAttributes<HTMLSelectElement>;

export function Select({
  label,
  error,
  hint,
  id,
  className = "",
  children,
  ...rest
}: SelectProps) {
  const fieldId = id ?? rest.name ?? label;
  return (
    <Field label={label} error={error} hint={hint} htmlFor={fieldId}>
      <select
        id={fieldId}
        className={`ws-input ws-input--select ${className}`.trim()}
        aria-invalid={error ? true : undefined}
        {...rest}
      >
        {children}
      </select>
    </Field>
  );
}
