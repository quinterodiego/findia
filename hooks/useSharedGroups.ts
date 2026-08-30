'use client';

import { useState, useCallback } from 'react';
import type { SharedGroup, SharedGroupMember, SharedGroupExpense, SharedGroupSplit, SharedGroupSettlement, SharedGroupPairBalance } from '@/types';

export interface SharedGroupSummary {
  group: SharedGroup;
  myMemberId: string;
  balances: SharedGroupPairBalance[];
  members: Array<{ id: string; name: string }>;
}

export interface SharedGroupExpenseWithSplits extends SharedGroupExpense {
  splits: SharedGroupSplit[];
}

/** Error de API con el status HTTP preservado, para que la UI pueda mostrar
 * un mensaje distinto ante un 500 (posible rate-limit de Sheets) que ante un
 * 400/403/404/409 (ya trae un mensaje de negocio legible desde el backend). */
export class SharedGroupsApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new SharedGroupsApiError(response.status, data.error || 'Ocurrió un error inesperado');
  }
  return data as T;
}

export function useSharedGroups() {
  // Lista de grupos (con balance ya incluido — GET /api/shared-groups devuelve
  // el resumen agregado de Fase 2, nunca se pide /balance por separado acá).
  const [groups, setGroups] = useState<SharedGroupSummary[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [groupsError, setGroupsError] = useState<string | null>(null);
  // Se vuelve true tras cualquier mutación de expense/settlement mientras se
  // está dentro del detalle de un grupo — señal para refrescar la lista recién
  // cuando el usuario vuelva a verla, no de inmediato (evita fetches de más).
  const [groupsStale, setGroupsStale] = useState(false);

  // Detalle del grupo actualmente abierto.
  const [groupDetail, setGroupDetail] = useState<SharedGroup | null>(null);
  const [myMemberId, setMyMemberId] = useState<string | null>(null);
  const [members, setMembers] = useState<SharedGroupMember[]>([]);
  const [expenses, setExpenses] = useState<SharedGroupExpenseWithSplits[]>([]);
  const [settlements, setSettlements] = useState<SharedGroupSettlement[]>([]);
  const [balance, setBalance] = useState<SharedGroupPairBalance[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Loading específico de acciones (crear/editar/borrar) para deshabilitar botones y evitar doble submit.
  const [actionLoading, setActionLoading] = useState(false);

  const fetchGroups = useCallback(async () => {
    setLoadingGroups(true);
    setGroupsError(null);
    try {
      const data = await requestJson<{ groups: SharedGroupSummary[] }>('/api/shared-groups');
      setGroups(Array.isArray(data.groups) ? data.groups : []);
      setGroupsStale(false);
    } catch (err) {
      setGroupsError(err instanceof SharedGroupsApiError ? err.message : 'Error desconocido');
      throw err;
    } finally {
      setLoadingGroups(false);
    }
  }, []);

  /** Llama a fetchGroups() solo si la lista quedó marcada como desactualizada
   * por una mutación previa — evita refrescar la lista completa "por las dudas". */
  const refreshGroupsIfStale = useCallback(async () => {
    if (groupsStale) {
      await fetchGroups().catch(() => undefined);
    }
  }, [groupsStale, fetchGroups]);

  const createGroup = useCallback(
    async (name: string) => {
      setActionLoading(true);
      try {
        const data = await requestJson<{ group: SharedGroup; creatorMember: SharedGroupMember }>('/api/shared-groups', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        });
        await fetchGroups();
        return data;
      } finally {
        setActionLoading(false);
      }
    },
    [fetchGroups]
  );

  const fetchMembers = useCallback(async (groupId: string) => {
    const data = await requestJson<{ members: SharedGroupMember[] }>(`/api/shared-groups/${groupId}/members`);
    setMembers(Array.isArray(data.members) ? data.members : []);
    return data.members;
  }, []);

  const fetchExpenses = useCallback(async (groupId: string) => {
    const data = await requestJson<{ expenses: SharedGroupExpenseWithSplits[] }>(`/api/shared-groups/${groupId}/expenses`);
    setExpenses(Array.isArray(data.expenses) ? data.expenses : []);
    return data.expenses;
  }, []);

  const fetchSettlements = useCallback(async (groupId: string) => {
    const data = await requestJson<{ settlements: SharedGroupSettlement[] }>(`/api/shared-groups/${groupId}/settlements`);
    setSettlements(Array.isArray(data.settlements) ? data.settlements : []);
    return data.settlements;
  }, []);

  const fetchBalance = useCallback(async (groupId: string) => {
    const data = await requestJson<{ balances: SharedGroupPairBalance[] }>(`/api/shared-groups/${groupId}/balance`);
    setBalance(Array.isArray(data.balances) ? data.balances : []);
    return data.balances;
  }, []);

  /**
   * Abre el detalle de un grupo. El `group` y el `balance` iniciales se toman
   * del summary YA cargado en `groups` (si está disponible) para no volver a
   * pedirlos — solo se hacen 3 fetches nuevos (members, expenses, settlements),
   * los únicos datos que el summary de la lista no trae.
   *
   * `groupDetail` (el gate que saca el spinner en DetailView) recién se
   * confirma DESPUÉS de que members/expenses/settlements/balance también
   * están listos. Antes se confirmaba primero y esos fetches quedaban en
   * vuelo, así que un grupo recién creado se veía brevemente (o, con Sheets
   * lento, de forma persistente) como "Miembros (0)" con datos reales ya
   * existentes en el backend — no era el dato real, era ese hueco de estado.
   */
  const openGroup = useCallback(
    async (groupId: string) => {
      setLoadingDetail(true);
      setDetailError(null);
      try {
        const cached = groups.find((g) => g.group.id === groupId);
        if (cached) {
          await Promise.all([fetchMembers(groupId), fetchExpenses(groupId), fetchSettlements(groupId)]);
          setGroupDetail(cached.group);
          setMyMemberId(cached.myMemberId);
          setBalance(cached.balances);
        } else {
          // No estaba en el summary (ej. se entró por otra vía, o el grupo se
          // acaba de crear y el summary local todavía no lo incluye) -- se
          // piden en paralelo el detalle del grupo y el resto de los datos.
          const [data] = await Promise.all([
            requestJson<{ group: SharedGroup; myMemberId: string }>(`/api/shared-groups/${groupId}`),
            fetchMembers(groupId),
            fetchExpenses(groupId),
            fetchSettlements(groupId),
            fetchBalance(groupId),
          ]);
          setGroupDetail(data.group);
          setMyMemberId(data.myMemberId);
        }
      } catch (err) {
        setDetailError(err instanceof SharedGroupsApiError ? err.message : 'Error desconocido');
        throw err;
      } finally {
        setLoadingDetail(false);
      }
    },
    [groups, fetchMembers, fetchExpenses, fetchSettlements, fetchBalance]
  );

  const closeGroup = useCallback(() => {
    setGroupDetail(null);
    setMyMemberId(null);
    setMembers([]);
    setExpenses([]);
    setSettlements([]);
    setBalance([]);
    setDetailError(null);
  }, []);

  const renameGroup = useCallback(async (groupId: string, name: string) => {
    setActionLoading(true);
    try {
      const data = await requestJson<{ group: SharedGroup }>(`/api/shared-groups/${groupId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      setGroupDetail(data.group);
      setGroupsStale(true);
      return data.group;
    } finally {
      setActionLoading(false);
    }
  }, []);

  const deleteGroup = useCallback(async (groupId: string) => {
    setActionLoading(true);
    try {
      await requestJson(`/api/shared-groups/${groupId}`, { method: 'DELETE' });
      await fetchGroups();
    } finally {
      setActionLoading(false);
    }
  }, [fetchGroups]);

  // ---------------------------------------------------------------------------
  // Members — mutar solo requiere refrescar members (el balance no cambia por
  // metadata de un miembro; agregarlo/editarlo/borrarlo nunca lo afecta).
  // ---------------------------------------------------------------------------

  const addMember = useCallback(
    async (groupId: string, data: { name: string; email?: string }) => {
      setActionLoading(true);
      try {
        const result = await requestJson<{ member: SharedGroupMember }>(`/api/shared-groups/${groupId}/members`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        await fetchMembers(groupId);
        return result.member;
      } finally {
        setActionLoading(false);
      }
    },
    [fetchMembers]
  );

  const editMember = useCallback(
    async (groupId: string, memberId: string, data: { name?: string; email?: string }) => {
      setActionLoading(true);
      try {
        const result = await requestJson<{ member: SharedGroupMember }>(`/api/shared-groups/${groupId}/members/${memberId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        await fetchMembers(groupId);
        return result.member;
      } finally {
        setActionLoading(false);
      }
    },
    [fetchMembers]
  );

  const deleteMember = useCallback(
    async (groupId: string, memberId: string) => {
      setActionLoading(true);
      try {
        await requestJson(`/api/shared-groups/${groupId}/members/${memberId}`, { method: 'DELETE' });
        await fetchMembers(groupId);
      } finally {
        setActionLoading(false);
      }
    },
    [fetchMembers]
  );

  // ---------------------------------------------------------------------------
  // Expenses — mutar afecta el balance (y el resumen de la lista queda stale).
  // ---------------------------------------------------------------------------

  interface ExpensePayload {
    description: string;
    amount: number;
    currency: 'pesos' | 'usd';
    paidByMemberId: string;
    date: string;
    splitType: 'equal' | 'amount';
    participantMemberIds?: string[];
    splits?: { memberId: string; amount: number }[];
  }

  const createExpense = useCallback(
    async (groupId: string, payload: ExpensePayload) => {
      setActionLoading(true);
      try {
        const result = await requestJson<{ expense: SharedGroupExpense; splits: SharedGroupSplit[] }>(
          `/api/shared-groups/${groupId}/expenses`,
          { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
        );
        await Promise.all([fetchExpenses(groupId), fetchBalance(groupId)]);
        setGroupsStale(true);
        return result;
      } finally {
        setActionLoading(false);
      }
    },
    [fetchExpenses, fetchBalance]
  );

  const updateExpense = useCallback(
    async (groupId: string, expenseId: string, payload: Partial<ExpensePayload>) => {
      setActionLoading(true);
      try {
        const result = await requestJson<{ expense: SharedGroupExpense }>(`/api/shared-groups/${groupId}/expenses/${expenseId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        await Promise.all([fetchExpenses(groupId), fetchBalance(groupId)]);
        setGroupsStale(true);
        return result.expense;
      } finally {
        setActionLoading(false);
      }
    },
    [fetchExpenses, fetchBalance]
  );

  const deleteExpense = useCallback(
    async (groupId: string, expenseId: string) => {
      setActionLoading(true);
      try {
        await requestJson(`/api/shared-groups/${groupId}/expenses/${expenseId}`, { method: 'DELETE' });
        await Promise.all([fetchExpenses(groupId), fetchBalance(groupId)]);
        setGroupsStale(true);
      } finally {
        setActionLoading(false);
      }
    },
    [fetchExpenses, fetchBalance]
  );

  // ---------------------------------------------------------------------------
  // Settlements — mismo criterio que expenses.
  // ---------------------------------------------------------------------------

  interface SettlementPayload {
    paidByMemberId: string;
    paidToMemberId: string;
    amount: number;
    currency: 'pesos' | 'usd';
    date: string;
    notes?: string;
  }

  const createSettlement = useCallback(
    async (groupId: string, payload: SettlementPayload) => {
      setActionLoading(true);
      try {
        const result = await requestJson<{ settlement: SharedGroupSettlement }>(`/api/shared-groups/${groupId}/settlements`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        await Promise.all([fetchSettlements(groupId), fetchBalance(groupId)]);
        setGroupsStale(true);
        return result.settlement;
      } finally {
        setActionLoading(false);
      }
    },
    [fetchSettlements, fetchBalance]
  );

  const updateSettlement = useCallback(
    async (groupId: string, settlementId: string, payload: Partial<SettlementPayload>) => {
      setActionLoading(true);
      try {
        const result = await requestJson<{ settlement: SharedGroupSettlement }>(
          `/api/shared-groups/${groupId}/settlements/${settlementId}`,
          { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
        );
        await Promise.all([fetchSettlements(groupId), fetchBalance(groupId)]);
        setGroupsStale(true);
        return result.settlement;
      } finally {
        setActionLoading(false);
      }
    },
    [fetchSettlements, fetchBalance]
  );

  const deleteSettlement = useCallback(
    async (groupId: string, settlementId: string) => {
      setActionLoading(true);
      try {
        await requestJson(`/api/shared-groups/${groupId}/settlements/${settlementId}`, { method: 'DELETE' });
        await Promise.all([fetchSettlements(groupId), fetchBalance(groupId)]);
        setGroupsStale(true);
      } finally {
        setActionLoading(false);
      }
    },
    [fetchSettlements, fetchBalance]
  );

  return {
    // Lista
    groups,
    loadingGroups,
    groupsError,
    fetchGroups,
    refreshGroupsIfStale,
    createGroup,

    // Detalle
    groupDetail,
    myMemberId,
    members,
    expenses,
    settlements,
    balance,
    loadingDetail,
    detailError,
    openGroup,
    closeGroup,
    renameGroup,
    deleteGroup,

    // Members
    addMember,
    editMember,
    deleteMember,

    // Expenses
    createExpense,
    updateExpense,
    deleteExpense,

    // Settlements
    createSettlement,
    updateSettlement,
    deleteSettlement,

    // Acciones en curso (para disabled de botones / evitar doble submit)
    actionLoading,
  };
}
