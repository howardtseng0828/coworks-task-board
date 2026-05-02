import { useCallback, useEffect, useState } from "react";
import { taskService } from "../services/taskService";
import type { Group, User } from "../types";

const parseError = (error: unknown) =>
  error instanceof Error ? error.message : "讀取人員/群組資料失敗。";

export const useLookups = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [nextUsers, nextGroups] = await Promise.all([taskService.getUsers(), taskService.getGroups()]);
      setUsers(nextUsers);
      setGroups(nextGroups);
    } catch (requestError) {
      setError(parseError(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { users, groups, loading, error, reload };
};
