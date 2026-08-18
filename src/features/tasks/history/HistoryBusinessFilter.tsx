import { useCallback, useEffect, useRef, useState } from "react";

import {
  listContacts,
  mapContactError,
  type Contact,
  type ContactAppError,
} from "../../../services/tauri/contacts";
import type { TaskStatus } from "../../../services/tauri/tasks";
import { Input, Select } from "../../../shared/ui";
import {
  HISTORY_PRIORITY_OPTIONS,
  HISTORY_STATUS_OPTIONS,
  type HistoryFilterState,
} from "./historyFilterModel";
import "./HistoryBusinessFilter.css";

const KEYWORD_DEBOUNCE_MS = 300;

type HistoryBusinessFilterProps = {
  filter: HistoryFilterState;
  onChange: (next: HistoryFilterState) => void;
};

export function HistoryBusinessFilter({ filter, onChange }: HistoryBusinessFilterProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactsError, setContactsError] = useState<string | null>(null);
  const [keywordDraft, setKeywordDraft] = useState(filter.keyword);
  const filterRef = useRef(filter);

  filterRef.current = filter;

  useEffect(() => {
    setKeywordDraft(filter.keyword);
  }, [filter.keyword]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (keywordDraft.trim() === filterRef.current.keyword.trim() && keywordDraft === filterRef.current.keyword) {
        return;
      }
      onChange({ ...filterRef.current, keyword: keywordDraft });
    }, KEYWORD_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [keywordDraft, onChange]);

  useEffect(() => {
    let cancelled = false;

    void listContacts()
      .then((next) => {
        if (!cancelled) {
          setContacts(next);
          setContactsError(null);
        }
      })
      .catch((caught) => {
        if (!cancelled) {
          setContacts([]);
          setContactsError(mapContactError(caught as ContactAppError));
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleStatusChange = useCallback(
    (value: string) => {
      onChange({
        ...filter,
        status: value ? (value as TaskStatus) : undefined,
      });
    },
    [filter, onChange],
  );

  const handlePriorityChange = useCallback(
    (value: string) => {
      onChange({
        ...filter,
        priority: value ? Number(value) : undefined,
      });
    },
    [filter, onChange],
  );

  const handleContactChange = useCallback(
    (value: string) => {
      onChange({
        ...filter,
        contactId: value || undefined,
      });
    },
    [filter, onChange],
  );

  return (
    <div className="history-business-filter">
      <Select
        label="状态"
        value={filter.status ?? ""}
        onChange={(event) => handleStatusChange(event.target.value)}
      >
        <option value="">全部状态</option>
        {HISTORY_STATUS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>

      <Select
        label="紧急程度"
        value={filter.priority?.toString() ?? ""}
        onChange={(event) => handlePriorityChange(event.target.value)}
      >
        <option value="">全部紧急程度</option>
        {HISTORY_PRIORITY_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>

      <Select
        label="对接人"
        value={filter.contactId ?? ""}
        onChange={(event) => handleContactChange(event.target.value)}
      >
        <option value="">全部对接人</option>
        {contacts.map((contact) => (
          <option key={contact.id} value={contact.id}>
            {contact.name}
          </option>
        ))}
      </Select>

      <Input
        label="关键词"
        placeholder="搜索任务名称或备注"
        value={keywordDraft}
        onChange={(event) => setKeywordDraft(event.target.value)}
      />
      {contactsError ? (
        <p className="history-business-filter__error" role="alert">
          {contactsError}
        </p>
      ) : null}
    </div>
  );
}
