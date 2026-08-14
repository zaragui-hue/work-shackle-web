import { useCallback, useEffect, useState } from "react";

import {
  createContact,
  deactivateContact,
  listContacts,
  mapContactError,
  type Contact,
  type ContactAppError,
} from "../../services/tauri/contacts";
import { Button, Field, Input } from "../../shared/ui";
import "./ContactPicker.css";

type ContactPickerProps = {
  active: boolean;
  value?: string;
  onChange: (contactId?: string) => void;
  error?: string;
  disabled?: boolean;
};

export function ContactPicker({
  active,
  value,
  onChange,
  error,
  disabled = false,
}: ContactPickerProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [newContactName, setNewContactName] = useState("");
  const [adding, setAdding] = useState(false);

  const loadContacts = useCallback(async () => {
    setLoading(true);
    setActionError(null);
    try {
      const next = await listContacts();
      setContacts(next);
    } catch (caught) {
      setActionError(mapContactError(caught as ContactAppError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!active) {
      return;
    }
    void loadContacts();
  }, [active, loadContacts]);

  const handleSelect = (contactId: string) => {
    if (disabled) {
      return;
    }
    onChange(value === contactId ? undefined : contactId);
  };

  const handleAddContact = async () => {
    const name = newContactName.trim();
    if (!name || disabled || adding) {
      return;
    }

    setAdding(true);
    setActionError(null);
    try {
      const created = await createContact({ name });
      setNewContactName("");
      await loadContacts();
      onChange(created.id);
    } catch (caught) {
      setActionError(mapContactError(caught as ContactAppError));
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (contactId: string) => {
    if (disabled) {
      return;
    }

    setActionError(null);
    try {
      await deactivateContact(contactId);
      if (value === contactId) {
        onChange(undefined);
      }
      await loadContacts();
    } catch (caught) {
      setActionError(mapContactError(caught as ContactAppError));
    }
  };

  const displayError = error ?? actionError;

  return (
    <Field label="对接人" error={displayError ?? undefined} htmlFor="contact-add-input">
      <section className="contact-picker" aria-labelledby="contact-picker-recent">
        <div className="contact-picker__header">
          <h3 id="contact-picker-recent">最近使用</h3>
          {loading ? <span className="contact-picker__meta">加载中…</span> : null}
        </div>

        {contacts.length === 0 && !loading ? (
          <p className="contact-picker__empty">还没有可选对接人。</p>
        ) : (
          <ul className="contact-picker__list">
            {contacts.map((contact) => {
              const selected = value === contact.id;
              return (
                <li key={contact.id} className="contact-picker__item">
                  <button
                    type="button"
                    className={`contact-picker__chip${selected ? " contact-picker__chip--selected" : ""}`}
                    aria-pressed={selected}
                    disabled={disabled}
                    onClick={() => handleSelect(contact.id)}
                  >
                    {contact.name}
                  </button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={disabled}
                    onClick={() => void handleRemove(contact.id)}
                  >
                    移除
                  </Button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="contact-picker__add">
          <Input
            id="contact-add-input"
            label="添加新对接人"
            placeholder="输入名称"
            value={newContactName}
            disabled={disabled || adding}
            onChange={(event) => setNewContactName(event.target.value)}
          />
          <Button
            type="button"
            variant="wheat"
            disabled={disabled || adding || !newContactName.trim()}
            onClick={() => void handleAddContact()}
          >
            {adding ? "添加中…" : "添加"}
          </Button>
        </div>
      </section>
    </Field>
  );
}
